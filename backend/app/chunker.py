def split_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    if not text.strip():
        return []

    paragraphs = text.split("\n")
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 1 <= chunk_size:
            current_chunk += ("\n" + para) if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If a single paragraph exceeds chunk_size, split it further
            if len(para) > chunk_size:
                words = para
                while len(words) > chunk_size:
                    split_point = words[:chunk_size].rfind(" ")
                    if split_point == -1:
                        split_point = chunk_size
                    chunks.append(words[:split_point])
                    words = words[max(0, split_point - overlap):]
                current_chunk = words
            else:
                # Start new chunk with overlap from previous
                if chunks:
                    prev = chunks[-1]
                    overlap_text = prev[-overlap:] if len(prev) > overlap else prev
                    current_chunk = overlap_text + "\n" + para
                else:
                    current_chunk = para

    if current_chunk.strip():
        chunks.append(current_chunk)

    return chunks
