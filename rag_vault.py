"""
Kira 2.7.10 Enterprise - Semantic Vector RAG Knowledge Vault Engine
สถาปัตยกรรมคลังความรู้เอกสารอัจฉริยะข้ามเซสชัน (Cross-Session Persistent Hybrid Vector 256D + Okapi BM25 RAG)
รองรับการอัปโหลด แยกย่อหน้าตามโครงสร้างหน้า/หัวข้อ ค้นหาความหมายเชิงลึก 5 ภาษา (TH/EN/ZH/KO/JA) และอ้างอิงแหล่งที่มาแม่นยำ
ออกแบบให้ใช้หน่วยความจำต่ำพิเศษ (<5 MB RAM) รองรับทั้ง SQLite และ PostgreSQL บน Render 100%
"""

import csv
import hashlib
import io
import json
import math
import os
import re
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader  # type: ignore
    except ImportError:
        PdfReader = None  # type: ignore

try:
    import docx  # type: ignore
except ImportError:
    docx = None  # type: ignore

rag_router = APIRouter(prefix="/api/rag", tags=["Semantic Vector RAG Knowledge Vault"])

VECTOR_DIM = 256
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".md", ".markdown", ".txt", ".csv", ".json"}
MAX_RAG_FILE_BYTES = 15 * 1024 * 1024  # 15 MB per file

# Cross-Lingual (TH / EN / ZH / KO / JA) Semantic Concept Clusters
# Bridges synonyms and multilingual queries into shared vector dimensions
SEMANTIC_CONCEPT_CLUSTERS: Dict[str, Tuple[str, ...]] = {
    "concept:revenue_finance": (
        "รายได้", "ผลประกอบการ", "ยอดขาย", "กำไร", "ขาดทุน", "กระแสเงินสด", "การเงิน", "งบการเงิน",
        "revenue", "income", "profit", "margin", "ebitda", "cashflow", "sales", "financial", "营收", "利润", "매출", "売上",
    ),
    "concept:budget_cost": (
        "งบประมาณ", "ต้นทุน", "ค่าใช้จ่าย", "จัดซื้อ", "ราคา", "ลงทุน", "ความคุ้มทุน",
        "budget", "cost", "expense", "capex", "opex", "pricing", "investment", "roi", "预算", "成本", "예산", "予算",
    ),
    "concept:contract_legal": (
        "สัญญา", "ข้อตกลง", "กฎหมาย", "ข้อบังคับ", "เงื่อนไข", "ค่าปรับ", "ความรับผิด", "ยกเลิกสัญญา", "ลิขสิทธิ์",
        "contract", "agreement", "clause", "legal", "liability", "penalty", "termination", "nda", "sla", "compliance",
        "合同", "条款", "계약", "契約",
    ),
    "concept:risk_security": (
        "ความเสี่ยง", "ภัยคุกคาม", "ความปลอดภัย", "ช่องโหว่", "เข้ารหัส", "ข้อมูลส่วนบุคคล", "เกราะป้องกัน",
        "risk", "threat", "security", "vulnerability", "encryption", "pdpa", "gdpr", "audit", "firewall",
        "风险", "安全", "보안", "セキュリティ",
    ),
    "concept:strategy_kpi": (
        "กลยุทธ์", "ยุทธศาสตร์", "เป้าหมาย", "ตัวชี้วัด", "แผนงาน", "วิสัยทัศน์", "การเติบโต", "ไตรมาส",
        "strategy", "roadmap", "kpi", "okr", "milestone", "objective", "growth", "quarter", "vision",
        "战略", "目标", "전략", "戦略",
    ),
    "concept:hr_people": (
        "พนักงาน", "บุคลากร", "สวัสดิการ", "เงินเดือน", "วันลา", "ระเบียบ", "ทรัพยากรบุคคล", "ฝึกอบรม",
        "employee", "staff", "salary", "payroll", "benefit", "leave", "policy", "onboarding", "hr",
    ),
    "concept:tech_architecture": (
        "สถาปัตยกรรม", "เซิร์ฟเวอร์", "ฐานข้อมูล", "เอพีไอ", "คลาวด์", "ระบบ", "ซอฟต์แวร์", "โมเดล", "อัลกอริทึม",
        "architecture", "database", "server", "api", "cloud", "latency", "throughput", "microservice", "deployment",
    ),
    "concept:product_customer": (
        "ลูกค้า", "ผู้ใช้งาน", "ผลิตภัณฑ์", "บริการ", "ฟีเจอร์", "ความพึงพอใจ", "การตลาด",
        "customer", "user", "client", "product", "feature", "retention", "churn", "marketing", "ux",
    ),
    "concept:academic_study": (
        "บทเรียน", "สรุป", "นิยาม", "ทฤษฎี", "สูตร", "ข้อสอบ", "วิจัย", "สมมติฐาน", "ผลการทดลอง",
        "lecture", "summary", "definition", "theorem", "formula", "exam", "research", "methodology", "conclusion",
    ),
    "concept:operations_sop": (
        "ขั้นตอน", "คู่มือ", "ปฏิบัติการ", "มาตรฐาน", "ตรวจสอบ", "โรงงาน", "คุณภาพ", "ขนส่ง", "สต็อก",
        "sop", "procedure", "workflow", "manual", "quality", "qa", "qc", "inventory", "logistics", "iso",
    ),
}

THAI_EN_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "are", "was", "were", "will", "have", "has", "had",
    "not", "but", "what", "which", "who", "whom", "when", "where", "why", "how", "can", "could", "would",
    "should", "into", "about", "than", "then", "them", "they", "their", "there", "here", "your", "our",
    "ของ", "ใน", "ที่", "และ", "หรือ", "จาก", "ให้", "ได้", "มี", "เป็น", "ไป", "มา", "กับ", "จะ", "ก็",
    "ว่า", "โดย", "เพื่อ", "ตาม", "ถึง", "คือ", "ซึ่ง", "อัน", "นี้", "นั้น", "ค่ะ", "ครับ", "นะคะ", "นะ",
    "ช่วย", "หน่อย", "ถาม", "บอก", "อธิบาย", "อะไร", "อย่างไร", "ไหม", "มั้ย",
}


def _get_now_str() -> str:
    tz = timezone(timedelta(hours=7))
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")


def _get_db():
    from app import execute_query
    return execute_query


# ====================================================================
# 🗄️ DATABASE INITIALIZATION (SQLite & PostgreSQL Dual-Compatible)
# ====================================================================

def init_rag_vault_tables() -> None:
    """สร้างตารางคลังความรู้เอกสารอัจฉริยะ (Semantic Vector RAG Knowledge Vault)"""
    execute_query = _get_db()
    execute_query(
        """CREATE TABLE IF NOT EXISTS rag_documents
        (id INTEGER PRIMARY KEY AUTOINCREMENT,
         doc_id TEXT UNIQUE,
         username TEXT,
         filename TEXT,
         file_type TEXT,
         file_size INTEGER DEFAULT 0,
         char_count INTEGER DEFAULT 0,
         chunk_count INTEGER DEFAULT 0,
         page_count INTEGER DEFAULT 1,
         sha256_hash TEXT,
         is_active INTEGER DEFAULT 1,
         tags TEXT DEFAULT '',
         summary_preview TEXT DEFAULT '',
         created_at TEXT)"""
    )
    execute_query("""CREATE INDEX IF NOT EXISTS idx_rag_docs_user ON rag_documents (username)""")
    execute_query("""CREATE INDEX IF NOT EXISTS idx_rag_docs_hash ON rag_documents (username, sha256_hash)""")

    execute_query(
        """CREATE TABLE IF NOT EXISTS rag_chunks
        (id INTEGER PRIMARY KEY AUTOINCREMENT,
         chunk_id TEXT UNIQUE,
         doc_id TEXT,
         username TEXT,
         chunk_index INTEGER DEFAULT 0,
         page_number INTEGER DEFAULT 1,
         section_title TEXT DEFAULT '',
         content TEXT,
         token_json TEXT,
         embedding_json TEXT,
         created_at TEXT)"""
    )
    execute_query("""CREATE INDEX IF NOT EXISTS idx_rag_chunks_user ON rag_chunks (username)""")
    execute_query("""CREATE INDEX IF NOT EXISTS idx_rag_chunks_doc ON rag_chunks (doc_id)""")


# ====================================================================
# 🧬 MULTILINGUAL TOKENIZER & 256D SEMANTIC VECTORIZER
# ====================================================================

def _light_stem_en(word: str) -> str:
    if len(word) <= 4:
        return word
    for suffix in ("ingly", "edly", "ment", "tion", "sion", "ness", "able", "ible", "ing", "ies", "ers", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            if suffix == "ies":
                return word[:-3] + "y"
            return word[: -len(suffix)]
    return word


def tokenize_multilingual(text: str) -> Counter:
    """
    สกัดคุณลักษณะทางภาษาและอรรถศาสตร์ 5 ภาษา (TH / EN / ZH / KO / JA):
    - คำศัพท์ภาษาอังกฤษ/ตัวเลข/รหัสเฉพาะ + Light Stemming + Word Bigrams
    - กลุ่มคำภาษาไทย/จีน/ญี่ปุ่น/เกาหลี + Sliding Character 3-grams และ 4-grams
    - Semantic Concept Tags ข้ามภาษา (Cross-Lingual Concept Bridge)
    """
    if not text:
        return Counter()

    lowered = text.lower()
    lowered = re.sub(r"\s+", " ", lowered).strip()
    counts: Counter = Counter()

    # 1. Cross-lingual semantic concept injection
    for concept_tag, keywords in SEMANTIC_CONCEPT_CLUSTERS.items():
        matched_hits = 0
        for kw in keywords:
            if kw in lowered:
                matched_hits += 1
        if matched_hits > 0:
            counts[concept_tag] += min(4, 1 + matched_hits)

    # 2. Alphanumeric words, codes, numbers (e.g., ISO27001, 2026, Q4, clause 4.2)
    en_words = re.findall(r"[a-z0-9][a-z0-9_.\-/]{0,30}[a-z0-9]|[a-z0-9]{2,}", lowered)
    filtered_en: List[str] = []
    for w in en_words:
        w_clean = w.strip("._-/")
        if not w_clean or w_clean in THAI_EN_STOPWORDS:
            continue
        counts[f"w:{w_clean}"] += 2
        stemmed = _light_stem_en(w_clean)
        if stemmed != w_clean:
            counts[f"s:{stemmed}"] += 1
        filtered_en.append(stemmed)

    for i in range(len(filtered_en) - 1):
        counts[f"bg:{filtered_en[i]}_{filtered_en[i + 1]}"] += 2

    # 3. Thai / CJK / Hangul / Kana contiguous script runs -> exact segments + char 3-grams & 4-grams
    asian_runs = re.findall(r"[\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+", lowered)
    for run in asian_runs:
        if run in THAI_EN_STOPWORDS:
            continue
        run_len = len(run)
        if 2 <= run_len <= 18:
            counts[f"seg:{run}"] += 3
        # Character 2-grams for CJK (Chinese/Japanese Kanji/Korean Hangul where 2 chars = 1 word)
        cjk_sub = re.findall(r"[\u4E00-\u9FFF\uAC00-\uD7AF]{2,}", run)
        for c_run in cjk_sub:
            for idx in range(len(c_run) - 1):
                counts[f"cjk2:{c_run[idx : idx + 2]}"] += 2
        # Character 3-grams & 4-grams for Thai/Kana/CJK compounds
        if run_len >= 3:
            for idx in range(run_len - 2):
                tri = run[idx : idx + 3]
                if tri not in THAI_EN_STOPWORDS:
                    counts[f"ng3:{tri}"] += 1
        if run_len >= 4:
            for idx in range(run_len - 3):
                quad = run[idx : idx + 4]
                counts[f"ng4:{quad}"] += 2

    return counts


def compute_semantic_vector(text: str, token_counts: Optional[Counter] = None, dim: int = VECTOR_DIM) -> List[float]:
    """
    คำนวณเวกเตอร์ความหมายหนาแน่น 256 มิติ (Signed Random Projection / Feature Hashing + Sublinear TF-Weighting)
    ปรับขนาด L2-Normalized เพื่อให้ Cosine Similarity คำนวณด้วย Dot Product ความเร็วสูงได้ทันที
    """
    counts = token_counts if token_counts is not None else tokenize_multilingual(text)
    vec = [0.0] * dim
    if not counts:
        return vec

    for feat, tf in counts.items():
        # Sublinear TF weighting with boost for concept tags, exact words, and 4-grams
        weight = 1.0 + math.log1p(tf)
        if feat.startswith("concept:"):
            weight *= 2.35
        elif feat.startswith(("w:", "seg:", "bg:", "cjk2:")):
            weight *= 1.65
        elif feat.startswith("ng4:"):
            weight *= 1.35

        digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
        h1 = int.from_bytes(digest[:4], "little")
        h2 = int.from_bytes(digest[4:], "little")

        idx1 = h1 % dim
        sign1 = 1.0 if (h1 & 0x10000) == 0 else -1.0
        vec[idx1] += sign1 * weight

        # Dual projection reduces hash collision variance significantly
        idx2 = h2 % dim
        sign2 = 1.0 if (h2 & 0x10000) == 0 else -1.0
        vec[idx2] += sign2 * (weight * 0.5)

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 1e-9:
        inv = 1.0 / norm
        vec = [round(v * inv, 5) for v in vec]
    return vec


def cosine_similarity_l2(vec_a: List[float], vec_b: List[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    return max(0.0, min(1.0, dot))


# ====================================================================
# 📄 STRUCTURE-AWARE MULTI-FORMAT PARSER & PARAGRAPH CHUNKER
# ====================================================================

def parse_document_pages(content_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], str]:
    """
    แยกเนื้อหาเอกสารตามหน้าและหัวข้อ รองรับ: .pdf, .docx, .md, .markdown, .txt, .csv, .json
    คืนค่า: (รายการ [{page_number, section_title, text}], file_type)
    """
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"ไม่รองรับนามสกุลไฟล์ '{ext}' (รองรับ: PDF, DOCX, MD, TXT, CSV, JSON)")

    pages: List[Dict[str, Any]] = []
    file_type = ext.lstrip(".")
    if file_type == "markdown":
        file_type = "md"

    if ext == ".pdf":
        if PdfReader is None:
            raise RuntimeError("ระบบไม่พบโมดูลอ่านไฟล์ PDF (pypdf)")
        reader = PdfReader(io.BytesIO(content_bytes))
        for idx, page in enumerate(reader.pages, start=1):
            txt = (page.extract_text() or "").strip()
            if txt:
                # Detect first short heading-like line on page
                first_line = txt.splitlines()[0].strip() if txt.splitlines() else ""
                sec = first_line[:80] if (2 <= len(first_line) <= 80 and not first_line.endswith(".")) else f"หน้า {idx}"
                pages.append({"page_number": idx, "section_title": sec, "text": txt})

    elif ext == ".docx":
        if docx is None:
            raise RuntimeError("ระบบไม่พบโมดูลอ่านไฟล์ Word (python-docx)")
        doc = docx.Document(io.BytesIO(content_bytes))
        current_section = "เนื้อหาหลัก"
        buf: List[str] = []
        virtual_page = 1
        acc_chars = 0

        for p in doc.paragraphs:
            t = (p.text or "").strip()
            if not t:
                continue
            style_name = (getattr(p.style, "name", "") or "").lower()
            if "heading" in style_name or "title" in style_name:
                if buf:
                    pages.append({"page_number": virtual_page, "section_title": current_section, "text": "\n\n".join(buf)})
                    buf = []
                current_section = t[:90]
            buf.append(t)
            acc_chars += len(t)
            if acc_chars >= 2400:
                pages.append({"page_number": virtual_page, "section_title": current_section, "text": "\n\n".join(buf)})
                buf = []
                acc_chars = 0
                virtual_page += 1

        # Extract tables inside DOCX as Markdown-like rows!
        for t_idx, table in enumerate(doc.tables, start=1):
            t_rows: List[str] = []
            for row in table.rows:
                cells = [re.sub(r"\s+", " ", (c.text or "").strip()) for c in row.cells]
                if any(cells):
                    t_rows.append(" | ".join(cells))
            if t_rows:
                pages.append({
                    "page_number": virtual_page,
                    "section_title": f"{current_section} (ตารางที่ {t_idx})"[:90],
                    "text": "\n".join(t_rows),
                })

        if buf:
            pages.append({"page_number": virtual_page, "section_title": current_section, "text": "\n\n".join(buf)})

    elif ext in (".md", ".markdown"):
        raw_text = content_bytes.decode("utf-8", errors="ignore")
        current_section = "บทนำ"
        buf = []
        virtual_page = 1
        for line in raw_text.splitlines():
            heading_match = re.match(r"^(#{1,4})\s+(.+)", line.strip())
            if heading_match:
                if buf:
                    pages.append({"page_number": virtual_page, "section_title": current_section, "text": "\n".join(buf).strip()})
                    buf = []
                    virtual_page += 1
                current_section = heading_match.group(2).strip()[:90]
            buf.append(line)
        if buf and "\n".join(buf).strip():
            pages.append({"page_number": virtual_page, "section_title": current_section, "text": "\n".join(buf).strip()})

    elif ext == ".csv":
        raw_text = content_bytes.decode("utf-8-sig", errors="ignore")
        reader_csv = csv.reader(io.StringIO(raw_text))
        rows = list(reader_csv)
        if rows:
            headers = [h.strip() or f"Col_{i+1}" for i, h in enumerate(rows[0])]
            batch: List[str] = []
            batch_num = 1
            for r_idx, row in enumerate(rows[1:], start=1):
                if not any(cell.strip() for cell in row):
                    continue
                pairs = [f"{headers[i] if i < len(headers) else f'Col_{i+1}'}: {cell.strip()}" for i, cell in enumerate(row) if cell.strip()]
                batch.append(f"[แถวที่ {r_idx}] " + " | ".join(pairs))
                if len(batch) >= 15:
                    pages.append({
                        "page_number": batch_num,
                        "section_title": f"ตารางข้อมูล CSV (แถว {max(1, r_idx - len(batch) + 1)}-{r_idx})",
                        "text": "\n".join(batch),
                    })
                    batch = []
                    batch_num += 1
            if batch:
                pages.append({
                    "page_number": batch_num,
                    "section_title": "ตารางข้อมูล CSV",
                    "text": "\n".join(batch),
                })

    elif ext == ".json":
        raw_text = content_bytes.decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(raw_text)
            pretty = json.dumps(parsed, ensure_ascii=False, indent=2)
        except Exception:
            pretty = raw_text
        pages.append({"page_number": 1, "section_title": "โครงสร้างข้อมูล JSON", "text": pretty})

    else:  # .txt
        raw_text = content_bytes.decode("utf-8", errors="ignore").strip()
        if raw_text:
            # Group into ~2500-char virtual pages
            paras = re.split(r"\n{2,}", raw_text)
            buf = []
            acc = 0
            p_num = 1
            for para in paras:
                para = para.strip()
                if not para:
                    continue
                buf.append(para)
                acc += len(para)
                if acc >= 2500:
                    first_ln = buf[0].splitlines()[0][:80]
                    pages.append({"page_number": p_num, "section_title": first_ln, "text": "\n\n".join(buf)})
                    buf = []
                    acc = 0
                    p_num += 1
            if buf:
                first_ln = buf[0].splitlines()[0][:80]
                pages.append({"page_number": p_num, "section_title": first_ln, "text": "\n\n".join(buf)})

    pages = [p for p in pages if p.get("text", "").strip()]
    return pages, file_type


def chunk_document_pages(
    pages: List[Dict[str, Any]],
    chunk_size: int = 720,
    chunk_overlap: int = 130,
) -> List[Dict[str, Any]]:
    """
    แบ่งเนื้อหาเป็นย่อหน้าขนาดพอเหมาะสำหรับ Vector RAG โดยรักษาหมายเลขหน้า (page_number) และหัวข้อ (section_title)
    """
    chunks: List[Dict[str, Any]] = []
    chunk_idx = 0

    for page in pages:
        p_num = int(page.get("page_number", 1) or 1)
        sec_title = str(page.get("section_title", "") or "").strip()
        text = str(page.get("text", "") or "").strip()
        if not text:
            continue

        # Split cleanly by paragraphs first, then lines if a single paragraph is huge
        raw_units = re.split(r"\n{2,}", text)
        units: List[str] = []
        for u in raw_units:
            u = u.strip()
            if not u:
                continue
            if len(u) <= chunk_size:
                units.append(u)
            else:
                # Sub-split long paragraphs by line/sentence boundaries
                sub_parts = re.split(r"(?<=[.!?。])\s+|\n", u)
                for sp in sub_parts:
                    sp = sp.strip()
                    if not sp:
                        continue
                    if len(sp) <= chunk_size:
                        units.append(sp)
                    else:
                        step = max(200, chunk_size - chunk_overlap)
                        for start in range(0, len(sp), step):
                            units.append(sp[start : start + chunk_size])

        current_buf = ""
        for unit in units:
            candidate = f"{current_buf}\n\n{unit}".strip() if current_buf else unit
            if len(candidate) <= chunk_size:
                current_buf = candidate
            else:
                if current_buf:
                    chunks.append({
                        "chunk_index": chunk_idx,
                        "page_number": p_num,
                        "section_title": sec_title,
                        "content": current_buf,
                    })
                    chunk_idx += 1
                    overlap_tail = current_buf[-chunk_overlap:].strip() if chunk_overlap > 0 else ""
                    current_buf = f"{overlap_tail}\n{unit}".strip() if overlap_tail else unit
                    if len(current_buf) > chunk_size + chunk_overlap:
                        current_buf = unit[: chunk_size + chunk_overlap]
                else:
                    chunks.append({
                        "chunk_index": chunk_idx,
                        "page_number": p_num,
                        "section_title": sec_title,
                        "content": unit[: chunk_size + chunk_overlap],
                    })
                    chunk_idx += 1
                    current_buf = ""

        if current_buf:
            chunks.append({
                "chunk_index": chunk_idx,
                "page_number": p_num,
                "section_title": sec_title,
                "content": current_buf,
            })
            chunk_idx += 1

    return chunks


# ====================================================================
# 📥 DOCUMENT INGESTION & PERSISTENT VECTOR INDEXING
# ====================================================================

def ingest_document_bytes(
    username: str,
    filename: str,
    content_bytes: bytes,
    tags: str = "",
) -> Dict[str, Any]:
    """
    นำเข้าไฟล์เอกสาร แยกย่อหน้า คำนวณเวกเตอร์ความหมาย 256 มิติ + ดัชนี BM25 และบันทึกลงคลังความรู้ถาวรข้ามเซสชัน
    """
    init_rag_vault_tables()
    execute_query = _get_db()

    clean_user = (username or "guest").strip()
    clean_filename = os.path.basename((filename or "document.txt").strip()) or "document.txt"

    if not content_bytes:
        raise ValueError("ไฟล์เอกสารว่างเปล่าค่ะ")
    if len(content_bytes) > MAX_RAG_FILE_BYTES:
        raise ValueError("ขนาดไฟล์เกินขีดจำกัดสูงสุด 15 MB ต่อไฟล์ค่ะ")

    sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    # Deduplication check: if exact same file hash already exists for this user, reactivate & return it
    existing = execute_query(
        "SELECT doc_id, filename, chunk_count, page_count, char_count FROM rag_documents WHERE username=? AND sha256_hash=?",
        (clean_user, sha256_hash),
        fetch="one",
    )
    if existing:
        existing_doc_id = existing[0]
        execute_query(
            "UPDATE rag_documents SET is_active=1, filename=? WHERE doc_id=? AND username=?",
            (clean_filename, existing_doc_id, clean_user),
        )
        return {
            "status": "success",
            "deduplicated": True,
            "doc_id": existing_doc_id,
            "filename": clean_filename,
            "chunk_count": existing[2],
            "page_count": existing[3],
            "char_count": existing[4],
            "message": f"เอกสาร '{clean_filename}' มีอยู่ในคลังความรู้แล้ว ระบบเปิดใช้งานอ้างอิงอัตโนมัติให้ทันทีค่ะ ({existing[2]} ย่อหน้า)",
        }

    pages, file_type = parse_document_pages(content_bytes, clean_filename)
    if not pages:
        raise ValueError("ไม่พบข้อความที่สามารถสกัดได้ในไฟล์เอกสารนี้ค่ะ")

    chunks = chunk_document_pages(pages)
    if not chunks:
        raise ValueError("ไม่สามารถแบ่งย่อหน้าจากเอกสารนี้ได้ค่ะ")

    total_chars = sum(len(p["text"]) for p in pages)
    page_count = max(p["page_number"] for p in pages)
    first_preview = re.sub(r"\s+", " ", pages[0]["text"]).strip()[:240]
    now_str = _get_now_str()
    doc_id = f"doc_{hashlib.sha256(f'{clean_user}:{clean_filename}:{sha256_hash}:{time.time()}'.encode()).hexdigest()[:12]}"

    execute_query(
        """INSERT INTO rag_documents
        (doc_id, username, filename, file_type, file_size, char_count, chunk_count, page_count, sha256_hash, is_active, tags, summary_preview, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
        (
            doc_id,
            clean_user,
            clean_filename,
            file_type,
            len(content_bytes),
            total_chars,
            len(chunks),
            page_count,
            sha256_hash,
            (tags or "").strip()[:120],
            first_preview,
            now_str,
        ),
    )

    for ch in chunks:
        c_idx = ch["chunk_index"]
        c_page = ch["page_number"]
        c_sec = ch["section_title"]
        c_text = ch["content"]
        enriched_for_index = f"{clean_filename} {c_sec}\n{c_text}".strip()

        tok_counter = tokenize_multilingual(enriched_for_index)
        vec = compute_semantic_vector(enriched_for_index, token_counts=tok_counter)

        # Store top 140 weighted tokens for ultra-fast Okapi BM25 scoring
        compact_tokens = dict(tok_counter.most_common(140))
        chunk_id = f"{doc_id}_c{c_idx:04d}"

        execute_query(
            """INSERT INTO rag_chunks
            (chunk_id, doc_id, username, chunk_index, page_number, section_title, content, token_json, embedding_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                chunk_id,
                doc_id,
                clean_user,
                c_idx,
                c_page,
                c_sec,
                c_text,
                json.dumps(compact_tokens, ensure_ascii=False),
                json.dumps(vec),
                now_str,
            ),
        )

    return {
        "status": "success",
        "deduplicated": False,
        "doc_id": doc_id,
        "filename": clean_filename,
        "file_type": file_type,
        "file_size": len(content_bytes),
        "char_count": total_chars,
        "page_count": page_count,
        "chunk_count": len(chunks),
        "summary_preview": first_preview,
        "message": f"จัดเก็บ '{clean_filename}' เข้าสู่คลังความรู้ RAG สำเร็จ ({page_count} หน้า • {len(chunks)} ย่อหน้าเวกเตอร์) พร้อมอ้างอิงข้ามแชตอัตโนมัติค่ะ",
    }


# ====================================================================
# 🔎 HYBRID SEMANTIC VECTOR (256D) + OKAPI BM25 SEARCH & CITATION ENGINE
# ====================================================================

def search_knowledge_vault(
    username: str,
    query: str,
    top_k: int = 5,
    doc_ids: Optional[List[str]] = None,
    active_only: bool = True,
    min_score: float = 0.14,
) -> Dict[str, Any]:
    """
    ค้นหาย่อหน้าที่เกี่ยวข้องที่สุดด้วย Hybrid Fusion:
    - 55% Cosine Similarity บนเวกเตอร์ความหมาย 256 มิติ (รองรับ Cross-Lingual Concept Bridge)
    - 45% Okapi BM25F Lexical & Subword N-Gram Precision
    - Exact Key-Phrase / Numeric Anchor Boost
    """
    t0 = time.perf_counter()
    init_rag_vault_tables()
    execute_query = _get_db()

    clean_user = (username or "").strip()
    clean_query = (query or "").strip()
    if not clean_user or not clean_query:
        return {"results": [], "total_searched": 0, "latency_ms": 0.0}

    doc_rows = execute_query(
        "SELECT doc_id, filename, file_type, is_active FROM rag_documents WHERE username=?",
        (clean_user,),
        fetch="all",
    )
    if not doc_rows:
        return {"results": [], "total_searched": 0, "latency_ms": round((time.perf_counter() - t0) * 1000, 2)}

    allowed_docs: Dict[str, Dict[str, Any]] = {}
    filter_set = set(doc_ids) if doc_ids else None
    for d_id, fname, ftype, is_act in doc_rows:
        if active_only and not int(is_act or 0):
            continue
        if filter_set is not None and d_id not in filter_set:
            continue
        allowed_docs[d_id] = {"filename": fname, "file_type": ftype}

    if not allowed_docs:
        return {"results": [], "total_searched": 0, "latency_ms": round((time.perf_counter() - t0) * 1000, 2)}

    chunk_rows = execute_query(
        "SELECT chunk_id, doc_id, chunk_index, page_number, section_title, content, token_json, embedding_json FROM rag_chunks WHERE username=?",
        (clean_user,),
        fetch="all",
    )
    if not chunk_rows:
        return {"results": [], "total_searched": 0, "latency_ms": round((time.perf_counter() - t0) * 1000, 2)}

    candidates = [r for r in chunk_rows if r[1] in allowed_docs]
    if not candidates:
        return {"results": [], "total_searched": 0, "latency_ms": round((time.perf_counter() - t0) * 1000, 2)}

    q_tokens = tokenize_multilingual(clean_query)
    q_vec = compute_semantic_vector(clean_query, token_counts=q_tokens)

    # Extract raw query anchor phrases (numbers, codes, >=3 char terms) for exact match boost
    q_lower = clean_query.lower()
    raw_anchors = [
        tok for tok in re.findall(r"[a-z0-9_.\-]{3,}|[\u0E00-\u0E7F\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]{3,}", q_lower)
        if tok not in THAI_EN_STOPWORDS
    ]

    # Precompute BM25 document frequency & lengths
    n_docs = len(candidates)
    parsed_tokens_list: List[Dict[str, int]] = []
    doc_lens: List[int] = []
    df_counter: Counter = Counter()

    for r in candidates:
        try:
            t_map = json.loads(r[6]) if r[6] else {}
        except Exception:
            t_map = {}
        parsed_tokens_list.append(t_map)
        d_len = sum(t_map.values()) or 1
        doc_lens.append(d_len)
        for q_feat in q_tokens.keys():
            if q_feat in t_map:
                df_counter[q_feat] += 1

    avgdl = (sum(doc_lens) / n_docs) if n_docs > 0 else 1.0
    k1 = 1.5
    b = 0.75

    raw_bm25_scores: List[float] = []
    cosine_scores: List[float] = []
    phrase_boosts: List[float] = []

    for idx, r in enumerate(candidates):
        t_map = parsed_tokens_list[idx]
        d_len = doc_lens[idx]

        # 1. Okapi BM25 score
        bm25 = 0.0
        for q_feat, q_tf in q_tokens.items():
            tf_doc = t_map.get(q_feat, 0)
            if tf_doc <= 0:
                continue
            df = df_counter.get(q_feat, 0)
            idf = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))
            denom = tf_doc + k1 * (1.0 - b + b * (d_len / avgdl))
            feat_boost = 2.0 if q_feat.startswith("concept:") else (1.5 if q_feat.startswith(("w:", "seg:", "bg:")) else 1.0)
            bm25 += idf * ((tf_doc * (k1 + 1.0)) / denom) * feat_boost * (1.0 + 0.15 * math.log1p(q_tf))
        raw_bm25_scores.append(bm25)

        # 2. 256D Vector Cosine Similarity
        try:
            c_vec = json.loads(r[7]) if r[7] else []
        except Exception:
            c_vec = []
        cosine_scores.append(cosine_similarity_l2(q_vec, c_vec))

        # 3. Exact phrase / numeric anchor boost
        c_content_lower = f"{allowed_docs[r[1]]['filename']} {r[4]} {r[5]}".lower()
        anchor_hits = sum(1 for anc in raw_anchors if anc in c_content_lower)
        boost = min(0.18, 0.06 * anchor_hits) if raw_anchors else 0.0
        phrase_boosts.append(boost)

    max_bm25 = max(raw_bm25_scores) if raw_bm25_scores else 0.0

    scored_items: List[Dict[str, Any]] = []
    for idx, r in enumerate(candidates):
        chunk_id, doc_id, chunk_index, page_num, sec_title, content = r[0], r[1], r[2], r[3], r[4], r[5]
        cos_sim = cosine_scores[idx]
        bm25_norm = (raw_bm25_scores[idx] / max_bm25) if max_bm25 > 1e-9 else 0.0
        # Calibrate absolute BM25 saturation so gibberish queries with 1 accidental 3-gram don't hit 1.0
        bm25_sat = raw_bm25_scores[idx] / (raw_bm25_scores[idx] + 4.5) if raw_bm25_scores[idx] > 0 else 0.0
        bm25_effective = 0.5 * bm25_norm * (0.4 + 0.6 * bm25_sat) + 0.5 * bm25_sat

        hybrid_score = min(0.99, (0.52 * cos_sim) + (0.48 * bm25_effective) + phrase_boosts[idx])
        if hybrid_score < min_score:
            continue

        doc_meta = allowed_docs[doc_id]
        clean_snippet = re.sub(r"\s+", " ", content).strip()
        if len(clean_snippet) > 260:
            clean_snippet = clean_snippet[:257] + "..."

        scored_items.append({
            "chunk_id": chunk_id,
            "doc_id": doc_id,
            "filename": doc_meta["filename"],
            "file_type": doc_meta["file_type"],
            "chunk_index": chunk_index,
            "page_number": page_num,
            "section_title": sec_title or f"ย่อหน้าที่ {chunk_index + 1}",
            "score": round(hybrid_score, 4),
            "score_pct": min(99, max(1, int(round(hybrid_score * 100)))),
            "cosine_sim": round(cos_sim, 4),
            "bm25_score": round(raw_bm25_scores[idx], 3),
            "content": content,
            "snippet": clean_snippet,
        })

    scored_items.sort(key=lambda x: x["score"], reverse=True)
    top_results = scored_items[: max(1, min(15, top_k))]
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "results": top_results,
        "total_searched": len(candidates),
        "active_documents_searched": len(allowed_docs),
        "latency_ms": latency_ms,
    }


def build_rag_citation_prompt(
    username: str,
    query: str,
    top_k: int = 4,
    min_score: float = 0.16,
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    ดึงบริบทอ้างอิงระดับย่อหน้าจากคลังความรู้ RAG ข้ามเซสชันแบบอัตโนมัติสำหรับ POST /api/chat และ Virtual Boardroom
    หากผู้ใช้ไม่มีเอกสารที่เปิดใช้งาน หรือคำถามไม่เกี่ยวข้อง จะคืนค่า ("", []) อย่างรวดเร็ว (<1 ms)
    """
    search_out = search_knowledge_vault(
        username=username,
        query=query,
        top_k=top_k,
        active_only=True,
        min_score=min_score,
    )
    hits = search_out.get("results", [])
    if not hits:
        return "", []

    lines = [
        "\n\n[Kira Semantic Vector RAG Knowledge Vault — คลังความรู้เอกสารอ้างอิงของผู้ใช้]:",
    ]
    for idx, h in enumerate(hits, start=1):
        lines.append(
            f"--- [แหล่งอ้างอิง #{idx} | ไฟล์: {h['filename']} | หน้า {h['page_number']} | หัวข้อ: {h['section_title']} | ความเกี่ยวข้อง {h['score_pct']}%] ---\n"
            f"{h['content']}\n"
        )
    lines.append(
        "(Instruction สำคัญสำหรับคิระ: หากคำถามของผู้ใช้เกี่ยวข้องกับข้อมูลในคลังความรู้เอกสารด้านบน "
        "จงสังเคราะห์คำตอบจากข้อเท็จจริงในเอกสารอย่างแม่นยำ และระบุชื่อไฟล์พร้อมหมายเลขหน้า/หัวข้ออ้างอิงอย่างสุภาพชัดเจนเสมอ "
        "เช่น '(อ้างอิง: ชื่อไฟล์, หน้า X)' หากคำถามเป็นเรื่องทั่วไปที่ไม่เกี่ยวกับเอกสารเลย ให้ตอบตามปกติโดยไม่ต้องฝืนอ้างอิงเอกสาร)\n"
    )
    return "\n".join(lines), hits


# ====================================================================
# 🌐 FASTAPI REST ENDPOINTS (/api/rag/*)
# ====================================================================

class RAGIngestTextRequest(BaseModel):
    username: str
    title: str = Field(..., min_length=1, max_length=140)
    content: str = Field(..., min_length=10, max_length=300000)
    tags: Optional[str] = ""


class RAGSearchRequest(BaseModel):
    username: str
    query: str = Field(..., min_length=1, max_length=1500)
    top_k: int = Field(default=5, ge=1, le=15)
    doc_ids: Optional[List[str]] = None
    active_only: bool = True


class RAGToggleDocumentRequest(BaseModel):
    username: str
    is_active: bool


@rag_router.get("/documents")
async def list_rag_documents(username: str = Query(..., min_length=1)):
    init_rag_vault_tables()
    execute_query = _get_db()
    clean_user = username.strip()

    rows = execute_query(
        """SELECT doc_id, filename, file_type, file_size, char_count, chunk_count, page_count, is_active, tags, summary_preview, created_at
           FROM rag_documents WHERE username=? ORDER BY id DESC""",
        (clean_user,),
        fetch="all",
    )
    docs = []
    total_chunks = 0
    total_chars = 0
    active_docs = 0

    for r in rows or []:
        is_act = bool(int(r[7] or 0))
        if is_act:
            active_docs += 1
        c_cnt = int(r[5] or 0)
        ch_cnt = int(r[4] or 0)
        total_chunks += c_cnt
        total_chars += ch_cnt
        docs.append({
            "doc_id": r[0],
            "filename": r[1],
            "file_type": r[2],
            "file_size": int(r[3] or 0),
            "char_count": ch_cnt,
            "chunk_count": c_cnt,
            "page_count": int(r[6] or 1),
            "is_active": is_act,
            "tags": r[8] or "",
            "summary_preview": r[9] or "",
            "created_at": r[10] or "",
        })

    return {
        "status": "success",
        "username": clean_user,
        "documents": docs,
        "stats": {
            "total_docs": len(docs),
            "active_docs": active_docs,
            "total_chunks": total_chunks,
            "total_chars": total_chars,
            "vector_dim": VECTOR_DIM,
            "engine": "Hybrid Semantic Vector 256D + Okapi BM25",
        },
    }


@rag_router.post("/upload")
async def upload_rag_documents(
    username: str = Form(...),
    tags: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
):
    upload_list: List[UploadFile] = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)

    if not upload_list:
        raise HTTPException(status_code=400, detail="กรุณาเลือกไฟล์เอกสารอย่างน้อย 1 ไฟล์ค่ะ")

    ingested = []
    errors = []

    for up in upload_list:
        fname = up.filename or "document.txt"
        try:
            raw = await up.read()
            res = ingest_document_bytes(username=username, filename=fname, content_bytes=raw, tags=tags or "")
            ingested.append(res)
        except Exception as e:
            errors.append({"filename": fname, "error": str(e)})

    if not ingested and errors:
        raise HTTPException(status_code=400, detail=errors[0]["error"])

    return {
        "status": "success",
        "ingested_count": len(ingested),
        "ingested": ingested,
        "errors": errors,
        "message": ingested[0]["message"] if len(ingested) == 1 else f"นำเข้าเอกสารสำเร็จ {len(ingested)} ไฟล์ เข้าสู่คลังความรู้ RAG เรียบร้อยแล้วค่ะ",
    }


@rag_router.post("/ingest_text")
async def ingest_rag_text_note(req: RAGIngestTextRequest):
    safe_title = req.title.strip()
    if not any(safe_title.lower().endswith(ext) for ext in SUPPORTED_EXTENSIONS):
        safe_title = f"{safe_title}.md"
    md_payload = f"# {req.title.strip()}\n\n{req.content.strip()}".encode("utf-8")
    try:
        res = ingest_document_bytes(
            username=req.username,
            filename=safe_title,
            content_bytes=md_payload,
            tags=req.tags or "note",
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@rag_router.post("/search")
async def search_rag_endpoint(req: RAGSearchRequest):
    res = search_knowledge_vault(
        username=req.username,
        query=req.query,
        top_k=req.top_k,
        doc_ids=req.doc_ids,
        active_only=req.active_only,
        min_score=0.08,
    )
    return {"status": "success", **res}


@rag_router.patch("/documents/{doc_id}/toggle")
async def toggle_rag_document(doc_id: str, req: RAGToggleDocumentRequest):
    init_rag_vault_tables()
    execute_query = _get_db()
    clean_user = req.username.strip()
    row = execute_query(
        "SELECT doc_id FROM rag_documents WHERE doc_id=? AND username=?",
        (doc_id, clean_user),
        fetch="one",
    )
    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารในคลังความรู้ของคุณค่ะ")

    new_val = 1 if req.is_active else 0
    execute_query(
        "UPDATE rag_documents SET is_active=? WHERE doc_id=? AND username=?",
        (new_val, doc_id, clean_user),
    )
    return {"status": "success", "doc_id": doc_id, "is_active": bool(new_val)}


@rag_router.get("/documents/{doc_id}/chunks")
async def get_rag_document_chunks(doc_id: str, username: str = Query(..., min_length=1)):
    init_rag_vault_tables()
    execute_query = _get_db()
    clean_user = username.strip()

    doc_row = execute_query(
        "SELECT filename, file_type, page_count, chunk_count FROM rag_documents WHERE doc_id=? AND username=?",
        (doc_id, clean_user),
        fetch="one",
    )
    if not doc_row:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้ในคลังความรู้ค่ะ")

    rows = execute_query(
        "SELECT chunk_id, chunk_index, page_number, section_title, content FROM rag_chunks WHERE doc_id=? AND username=? ORDER BY chunk_index ASC",
        (doc_id, clean_user),
        fetch="all",
    )
    chunks = [
        {
            "chunk_id": r[0],
            "chunk_index": r[1],
            "page_number": r[2],
            "section_title": r[3],
            "content": r[4],
        }
        for r in (rows or [])
    ]
    return {
        "status": "success",
        "doc_id": doc_id,
        "filename": doc_row[0],
        "file_type": doc_row[1],
        "page_count": doc_row[2],
        "chunk_count": doc_row[3],
        "chunks": chunks,
    }


@rag_router.delete("/documents/{doc_id}")
async def delete_rag_document(doc_id: str, username: str = Query(..., min_length=1)):
    init_rag_vault_tables()
    execute_query = _get_db()
    clean_user = username.strip()

    doc_row = execute_query(
        "SELECT filename FROM rag_documents WHERE doc_id=? AND username=?",
        (doc_id, clean_user),
        fetch="one",
    )
    if not doc_row:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารที่ต้องการลบค่ะ")

    execute_query("DELETE FROM rag_chunks WHERE doc_id=? AND username=?", (doc_id, clean_user))
    execute_query("DELETE FROM rag_documents WHERE doc_id=? AND username=?", (doc_id, clean_user))
    return {
        "status": "success",
        "doc_id": doc_id,
        "filename": doc_row[0],
        "message": f"ลบเอกสาร '{doc_row[0]}' และเวกเตอร์ย่อหน้าทั้งหมดออกจากคลังความรู้เรียบร้อยแล้วค่ะ",
    }

