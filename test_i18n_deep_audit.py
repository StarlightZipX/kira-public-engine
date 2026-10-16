import pytest
import re
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

def extract_kira_i18n():
    with open('static/script.js', 'r', encoding='utf-8') as f:
        text = f.read()

    start_idx = text.find('const KIRA_I18N = {')
    end_idx = text.find('const KIRA_QUICK_PROMPT_CONFIG =', start_idx)
    snippet = text[start_idx:end_idx]

    langs = ['th', 'en', 'zh', 'ko', 'ja']
    lang_positions = []
    for l in langs:
        m = re.search(rf'^\s*{l}:\s*\{{', snippet, re.MULTILINE)
        if m:
            lang_positions.append((l, m.start()))
    lang_positions.sort(key=lambda x: x[1])

    lang_blocks = {}
    for i in range(len(lang_positions)):
        l_name, start = lang_positions[i]
        end = lang_positions[i+1][1] if i+1 < len(lang_positions) else len(snippet)
        lang_blocks[l_name] = snippet[start:end]

    lang_keys = {}
    for lang, block in lang_blocks.items():
        pairs = re.findall(r'^\s*([a-zA-Z0-9_]+)\s*:\s*"([^"]*)"', block, re.MULTILINE)
        lang_keys[lang] = dict(pairs)

    return lang_keys

def test_i18n_dictionary_complete_parity():
    """Verify that all 5 languages have 100% key parity with Thai reference dictionary."""
    lang_dict = extract_kira_i18n()
    assert 'th' in lang_dict, "Thai dictionary missing"
    th_keys = set(lang_dict['th'].keys())
    assert len(th_keys) >= 250, f"Expected at least 250 keys in TH, found {len(th_keys)}"

    for lang in ['en', 'zh', 'ko', 'ja']:
        assert lang in lang_dict, f"Language {lang} missing from KIRA_I18N"
        target_keys = set(lang_dict[lang].keys())
        missing = th_keys - target_keys
        extra = target_keys - th_keys
        assert not missing, f"Language [{lang.upper()}] is missing {len(missing)} keys: {missing}"
        assert not extra, f"Language [{lang.upper()}] has unexpected extra keys: {extra}"

def test_i18n_no_untranslated_thai_in_foreign_languages():
    """Verify that foreign language dictionaries (en, zh, ko, ja) do not contain untranslated Thai text."""
    lang_dict = extract_kira_i18n()
    thai_char_regex = re.compile(r'[\u0e00-\u0e7f]')

    for lang in ['en', 'zh', 'ko', 'ja']:
        leaks = {}
        for key, text in lang_dict[lang].items():
            if thai_char_regex.search(text):
                leaks[key] = text
        assert not leaks, f"Language [{lang.upper()}] has Thai text leaks in {len(leaks)} keys: {leaks}"

def test_i18n_html_data_tags_validity():
    """Verify that all data-i18n, data-i18n-title, and data-i18n-placeholder attributes in index.html match dictionary."""
    with open('templates/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    lang_dict = extract_kira_i18n()
    th_keys = set(lang_dict['th'].keys())

    data_i18n_matches = re.findall(r'data-i18n="([^"]+)"', html)
    data_i18n_title_matches = re.findall(r'data-i18n-title="([^"]+)"', html)
    data_i18n_ph_matches = re.findall(r'data-i18n-placeholder="([^"]+)"', html)

    all_html_keys = set(data_i18n_matches + data_i18n_title_matches + data_i18n_ph_matches)
    assert len(all_html_keys) > 100, f"Expected >100 tagged elements, found {len(all_html_keys)}"

    invalid_keys = all_html_keys - th_keys
    assert not invalid_keys, f"Found data-i18n keys in index.html not defined in KIRA_I18N: {invalid_keys}"

def test_backend_ui_lang_models():
    """Verify that app.py request models accept ui_lang parameter."""
    from app import StudyRequest, MindMapRequest, BoardroomDebateRequest
    
    sr = StudyRequest(action="summarize", content="test", ui_lang="en")
    assert sr.ui_lang == "en"

    mr = MindMapRequest(content="test", ui_lang="zh")
    assert mr.ui_lang == "zh"

    br = BoardroomDebateRequest(topic="test", ui_lang="ja")
    assert br.ui_lang == "ja"

def test_frontend_study_placeholders_multilingual():
    """Verify that Study Hub placeholder map covers all 5 tabs in all 5 languages."""
    with open('static/script.js', 'r', encoding='utf-8') as f:
        script = f.read()

    assert "studyPlaceholdersMap" in script, "Missing studyPlaceholdersMap in script.js"
    assert "getStudyPlaceholder" in script, "Missing getStudyPlaceholder helper"

    for lang in ['th', 'en', 'zh', 'ko', 'ja']:
        assert f"{lang}:" in script, f"Missing {lang} block in studyPlaceholdersMap"

    for action in ['summarize', 'exam_prep', 'flashcards', 'polish_report', 'problem_solver']:
        assert f"{action}:" in script, f"Missing action {action} in studyPlaceholdersMap"

def test_frontend_fetch_calls_pass_ui_lang():
    """Verify that key API fetch calls pass ui_lang dynamically from localStorage."""
    with open('static/script.js', 'r', encoding='utf-8') as f:
        script = f.read()

    assert "ui_lang: localStorage.getItem('kira_ui_lang') || 'th'" in script, \
        "Missing ui_lang parameter in script.js API fetch requests"
