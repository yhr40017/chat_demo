import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
import httpx

from app.database import get_db
from app.config import settings
from app.models import Conversation, Message, Attachment
from app.schemas import ChatRequest
from app import vector_store

router = APIRouter(prefix="/api/conversations", tags=["chat"])


async def generate_title(model: str, user_message: str, assistant_response: str) -> str:
    prompt = (
        "다음 대화의 내용을 요약하여 짧은 제목(15자 이내)을 한국어로 만들어주세요. "
        "제목만 출력하고 다른 설명은 하지 마세요.\n\n"
        f"사용자: {user_message[:200]}\n"
        f"AI: {assistant_response[:200]}"
    )
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
            )
            data = resp.json()
            title = data.get("response", "").strip().strip('"').strip("'")
            return title[:50] if title else user_message[:50]
    except Exception:
        return user_message[:50]


@router.post("/{conversation_id}/chat")
async def chat(
    conversation_id: int,
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages), selectinload(Conversation.attachments))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")

    is_first_message = len(conv.messages) == 0

    user_message = Message(
        conversation_id=conversation_id, role="user", content=data.message
    )
    db.add(user_message)
    await db.commit()

    messages = []

    # RAG: 지식 저장소에서 관련 문서 검색
    rag_context = ""
    try:
        results = vector_store.search(query=data.message, n_results=5)
        if results:
            rag_parts = [r["content"] for r in results]
            rag_context = "\n\n---\n\n".join(rag_parts)
    except Exception:
        pass

    # 대화별 첨부파일 컨텍스트
    attachment_context = ""
    if conv.attachments:
        context_parts = []
        for att in conv.attachments:
            context_parts.append(f"[첨부파일: {att.filename}]\n{att.content_text[:8000]}")
        attachment_context = "\n\n".join(context_parts)

    # 시스템 프롬프트 구성
    system_parts = []
    if rag_context:
        system_parts.append(
            "다음은 지식 저장소에서 검색된 관련 문서 내용입니다. "
            "이 내용을 참고하여 답변하세요.\n\n" + rag_context
        )
    if attachment_context:
        system_parts.append(
            "다음은 사용자가 이 대화에 첨부한 문서 내용입니다.\n\n" + attachment_context
        )
    if system_parts:
        messages.append({"role": "system", "content": "\n\n".join(system_parts)})

    for m in conv.messages:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": data.message})

    async def generate():
        full_response = ""
        thinking_content = ""
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json={"model": conv.model, "messages": messages, "stream": True},
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            chunk = json.loads(line)
                            msg = chunk.get("message", {})
                            thinking = msg.get("thinking", "")
                            content = msg.get("content", "")

                            if thinking:
                                thinking_content += thinking
                                yield f"data: {json.dumps({'thinking': thinking})}\n\n"
                            if content:
                                full_response += content
                                yield f"data: {json.dumps({'token': content})}\n\n"
                            if chunk.get("done"):
                                break
        except httpx.HTTPError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        assistant_message = Message(
            conversation_id=conversation_id, role="assistant", content=full_response
        )
        db.add(assistant_message)
        await db.commit()

        title = None
        if is_first_message and full_response:
            title = await generate_title(conv.model, data.message, full_response)
            await db.execute(
                update(Conversation)
                .where(Conversation.id == conversation_id)
                .values(title=title)
            )
            await db.commit()

        yield f"data: {json.dumps({'done': True, 'title': title})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
