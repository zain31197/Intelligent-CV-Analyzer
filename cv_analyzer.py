
"""
cv_analyzer.py
Complete CV Analyzer that:
- extracts text from PDF and DOCX files
- implements Brute-Force, Rabin-Karp, and KMP string matching
- supports multiple keyword searches (case sensitive or insensitive)
- measures execution time, character comparisons, and RK collisions
- outputs per-CV match results and performance CSVs and charts

Usage:
    python cv_analyzer.py --cvs ./cvs_folder --jobs jobs.json --out results

jobs.json is a small JSON file containing job descriptions (see sample below).
"""

import os
import sys
import json
import time
import argparse
import math
import csv
from typing import List, Tuple, Dict
from dataclasses import dataclass, asdict
from tqdm import tqdm

# Text extraction
from pdfminer.high_level import extract_text as pdf_extract_text
import docx

# Data & plotting
import pandas as pd
import matplotlib.pyplot as plt

# -----------------------------
# Utilities: extraction & I/O
# -----------------------------
def extract_text_from_pdf(path: str) -> str:
    try:
        return pdf_extract_text(path)
    except Exception as e:
        print(f"[WARN] PDF extraction failed for {path}: {e}")
        return ""

def extract_text_from_docx(path: str) -> str:
    try:
        doc = docx.Document(path)
        paragraphs = [p.text for p in doc.paragraphs if p.text]
        return "\n".join(paragraphs)
    except Exception as e:
        print(f"[WARN] DOCX extraction failed for {path}: {e}")
        return ""

def load_cv_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext in (".docx", ".doc"):
        return extract_text_from_docx(path)
    else:
        # fallback: try to read as text
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except:
            return ""

# -----------------------------
# Instrumentation dataclass
# -----------------------------
@dataclass
class SearchStats:
    positions: List[int]
    comparisons: int
    time_seconds: float
    collisions: int = 0  # used for Rabin-Karp
    preprocess_ms: float = 0.0  # used for KMP LPS timing

# -----------------------------
# Algorithms
# -----------------------------
def brute_force_search(text: str, pattern: str) -> SearchStats:
    n = len(text)
    m = len(pattern)
    comparisons = 0
    positions = []
    t0 = time.perf_counter()
    if m == 0:
        return SearchStats(positions=list(range(n+1)), comparisons=0, time_seconds=0.0)
    for i in range(n - m + 1):
        j = 0
        while j < m:
            comparisons += 1
            if text[i + j] != pattern[j]:
                break
            j += 1
        if j == m:
            positions.append(i)
    t1 = time.perf_counter()
    return SearchStats(positions=positions, comparisons=comparisons, time_seconds=t1 - t0)

def compute_lps(pattern: str) -> Tuple[List[int], int, float]:
    """Compute LPS array for KMP and count comparisons used in building LPS (approx)."""
    m = len(pattern)
    lps = [0] * m
    length = 0
    i = 1
    # We won't count comparisons for LPS in main comparisons variable; main comparisons happen in search.
    t0 = time.perf_counter()
    while i < m:
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        else:
            if length != 0:
                length = lps[length - 1]
            else:
                lps[i] = 0
                i += 1
    t1 = time.perf_counter()
    return lps, 0, (t1 - t0) * 1000.0

def kmp_search(text: str, pattern: str) -> SearchStats:
    n = len(text)
    m = len(pattern)
    comparisons = 0
    positions = []
    if m == 0:
        return SearchStats(positions=list(range(n+1)), comparisons=0, time_seconds=0.0)
    lps, _, lps_ms = compute_lps(pattern)
    t0 = time.perf_counter()
    i = 0
    j = 0
    while i < n:
        comparisons += 1
        if text[i] == pattern[j]:
            i += 1
            j += 1
            if j == m:
                positions.append(i - j)
                j = lps[j - 1] if j > 0 else 0
        else:
            if j != 0:
                j = lps[j - 1]
            else:
                i += 1
    t1 = time.perf_counter()
    return SearchStats(positions=positions, comparisons=comparisons, time_seconds=t1 - t0, preprocess_ms=lps_ms)

def rabin_karp_search(text: str, pattern: str, base: int = 256, mod: int = 1000003) -> SearchStats:
    # Rolling hash Rabin-Karp with collision counting and comparison counting for verification
    n = len(text)
    m = len(pattern)
    comparisons = 0  # counts character-by-character checks performed when hashes match
    collisions = 0
    positions = []
    t0 = time.perf_counter()
    if m == 0:
        return SearchStats(positions=list(range(n+1)), comparisons=0, time_seconds=0.0)
    if m > n:
        return SearchStats(positions=[], comparisons=0, time_seconds=0.0)
    # precompute base^(m-1) % mod
    h = 1
    for _ in range(m - 1):
        h = (h * base) % mod
    # compute initial hash values
    p_hash = 0
    t_hash = 0
    for i in range(m):
        p_hash = (base * p_hash + ord(pattern[i])) % mod
        t_hash = (base * t_hash + ord(text[i])) % mod
    # rolling
    for i in range(n - m + 1):
        if p_hash == t_hash:
            # verify with direct comparison
            match = True
            for j in range(m):
                comparisons += 1
                if text[i + j] != pattern[j]:
                    match = False
                    collisions += 1
                    break
            if match:
                positions.append(i)
        if i < n - m:
            t_hash = (base * (t_hash - ord(text[i]) * h) + ord(text[i + m])) % mod
            if t_hash < 0:
                t_hash += mod
    t1 = time.perf_counter()
    return SearchStats(positions=positions, comparisons=comparisons, time_seconds=t1 - t0, collisions=collisions)

# -----------------------------
# Multi-pattern & matching logic
# -----------------------------
def search_keyword_with_algo(text: str, keyword: str, algo: str, case_sensitive: bool) -> SearchStats:
    if not case_sensitive:
        text = text.lower()
        keyword = keyword.lower()
    if algo == "bf":
        return brute_force_search(text, keyword)
    elif algo == "kmp":
        return kmp_search(text, keyword)
    elif algo == "rk":
        # choose a mod large enough; could parameterize
        return rabin_karp_search(text, keyword, base=256, mod=1000003)
    else:
        raise ValueError("Unknown algorithm " + algo)

def _compute_weighted_score(required_matched: int, total_required: int, optional_matched: int, total_optional: int, synonym_hits: int, weights: Dict[str, float]) -> float:
    # weights: {"required": 70, "optional": 20, "synonym": 10}
    w_req = weights.get("required", 70.0)
    w_opt = weights.get("optional", 20.0)
    w_syn = weights.get("synonym", 10.0)
    # If no required terms, shift weight to optional
    if total_required == 0:
        w_opt = w_req + w_opt
        w_req = 0.0
    base_required = (required_matched / total_required * w_req) if total_required > 0 else 0.0
    base_optional = (optional_matched / total_optional * w_opt) if total_optional > 0 else 0.0
    synonym_bonus = min(w_syn, synonym_hits * 2.0)
    score = round(base_required + base_optional + synonym_bonus, 2)
    return score

def analyze_cv_text(text: str, job_keywords: Dict[str, List[str]], algo: str, case_sensitive: bool):
    """
    job_keywords: {"mandatory": [...], "optional": [...]}
    returns:
        matched_mandatory, matched_optional, metrics (dict)
    """
    metrics = {}
    matched_mand = []
    matched_opt = []
    # For each keyword, call search; store per-keyword metrics
    all_metrics = []
    for cat in ("mandatory", "optional"):
        for kw in job_keywords.get(cat, []):
            stats = search_keyword_with_algo(text, kw, algo, case_sensitive)
            found = len(stats.positions) > 0
            if cat == "mandatory" and found:
                matched_mand.append(kw)
            if cat == "optional" and found:
                matched_opt.append(kw)
            entry = {
                "keyword": kw,
                "category": cat,
                "found": found,
                "occurrences": len(stats.positions),
                "positions": stats.positions,
                "comparisons": stats.comparisons,
                "time_s": stats.time_seconds,
                "collisions": getattr(stats, "collisions", 0),
                "preprocess_ms": getattr(stats, "preprocess_ms", 0.0),
            }
            all_metrics.append(entry)
    # compute relevance score: matched / total (mandatory and optional equally weighted)
    total_required = len(job_keywords.get("mandatory", [])) + len(job_keywords.get("optional", []))
    matched_total = len(matched_mand) + len(matched_opt)
    relevance_pct = (matched_total / total_required * 100) if total_required > 0 else 0.0
    # compute missing keywords
    missing_mand = [kw for kw in job_keywords.get("mandatory", []) if kw not in matched_mand]
    missing_opt = [kw for kw in job_keywords.get("optional", []) if kw not in matched_opt]
    # synonyms optional: job_keywords.get("synonyms", {base_kw: [syn1, syn2]})
    synonym_hits = 0
    synonyms = job_keywords.get("synonyms", {}) if isinstance(job_keywords.get("synonyms", {}), dict) else {}
    for base_kw, syn_list in synonyms.items():
        for syn in syn_list:
            syn_stats = search_keyword_with_algo(text, syn, algo, case_sensitive)
            if len(syn_stats.positions) > 0:
                synonym_hits += 1
    # weighted score
    weights = job_keywords.get("weights", {"required": 70.0, "optional": 20.0, "synonym": 10.0})
    score_weighted = _compute_weighted_score(len(matched_mand), len(job_keywords.get("mandatory", [])),
                                            len(matched_opt), len(job_keywords.get("optional", [])),
                                            synonym_hits, weights)
    metrics["per_keyword"] = all_metrics
    metrics["matched_mandatory"] = matched_mand
    metrics["matched_optional"] = matched_opt
    metrics["missing_mandatory"] = missing_mand
    metrics["missing_optional"] = missing_opt
    metrics["relevance_pct"] = relevance_pct
    metrics["score"] = score_weighted
    metrics["required_total"] = len(job_keywords.get("mandatory", []))
    metrics["optional_total"] = len(job_keywords.get("optional", []))
    metrics["synonym_hits"] = synonym_hits
    return metrics

# -----------------------------
# Batch processing & outputs
# -----------------------------
def iterate_cvs(cv_dir: str) -> List[str]:
    files = []
    for root, _, filenames in os.walk(cv_dir):
        for f in filenames:
            if f.lower().endswith((".pdf", ".docx", ".doc", ".txt")):
                files.append(os.path.join(root, f))
    return sorted(files)

def process_all(cvs_folder: str, jobs: Dict[str, Dict], algo: str, case_sensitive: bool, out_folder: str):
    os.makedirs(out_folder, exist_ok=True)
    cvs = iterate_cvs(cvs_folder)
    results_rows = []
    perf_rows = []
    print(f"[INFO] Found {len(cvs)} CVs.")
    for cv_path in tqdm(cvs, desc="Processing CVs"):
        text = load_cv_text(cv_path)
        if not text.strip():
            print(f"[WARN] No text extracted from {cv_path}")
        for job_name, job_keywords in jobs.items():
            metrics = analyze_cv_text(text, job_keywords, algo, case_sensitive)
            job_total_keywords = len(job_keywords.get("mandatory", [])) + len(job_keywords.get("optional", []))
            keyword_mode = "single" if job_total_keywords == 1 else "multiple"
            cv_size_bytes = 0
            try:
                cv_size_bytes = os.path.getsize(cv_path)
            except Exception:
                cv_size_bytes = 0
            cv_char_count = len(text)
            row = {
                "cv": os.path.basename(cv_path),
                "job": job_name,
                "matched_mandatory": ";".join(metrics["matched_mandatory"]),
                "matched_optional": ";".join(metrics["matched_optional"]),
                "missing_mandatory": ";".join(metrics["missing_mandatory"]),
                "missing_optional": ";".join(metrics["missing_optional"]),
                "relevance_pct": metrics["relevance_pct"],
                "cv_size_bytes": cv_size_bytes,
                "cv_char_count": cv_char_count,
                "job_total_keywords": job_total_keywords,
                "keyword_mode": keyword_mode
            }
            results_rows.append(row)
            # expand per-keyword perf rows
            for pk in metrics["per_keyword"]:
                perf_row = {
                    "cv": os.path.basename(cv_path),
                    "job": job_name,
                    "keyword": pk["keyword"],
                    "category": pk["category"],
                    "found": pk["found"],
                    "occurrences": pk["occurrences"],
                    "comparisons": pk["comparisons"],
                    "time_s": pk["time_s"],
                    "collisions": pk["collisions"],
                    "algorithm": algo,
                    "case_sensitive": case_sensitive,
                    "cv_size_bytes": cv_size_bytes,
                    "cv_char_count": cv_char_count,
                    "job_total_keywords": job_total_keywords,
                    "keyword_mode": keyword_mode
                }
                perf_rows.append(perf_row)
    # Write CSVs
    results_df = pd.DataFrame(results_rows)
    perf_df = pd.DataFrame(perf_rows)
    results_csv = os.path.join(out_folder, f"matches_{algo}_{'cs' if case_sensitive else 'ci'}.csv")
    perf_csv = os.path.join(out_folder, f"perf_{algo}_{'cs' if case_sensitive else 'ci'}.csv")
    results_df.to_csv(results_csv, index=False)
    perf_df.to_csv(perf_csv, index=False)
    print(f"[INFO] Results saved to {results_csv} and {perf_csv}")

    # Also produce per-job ranked candidate lists by relevance
    if not results_df.empty:
        for job_name, group in results_df.groupby("job"):
            ranked = group.sort_values(by="relevance_pct", ascending=False)
            safe_job = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in job_name)
            rank_csv = os.path.join(out_folder, f"rank_{algo}_{'cs' if case_sensitive else 'ci'}_{safe_job}.csv")
            ranked.to_csv(rank_csv, index=False)
            print(f"[INFO] Ranked candidates for job '{job_name}' saved to {rank_csv}")
    return results_df, perf_df

# -----------------------------
# Plotting helpers
# -----------------------------
def plot_performance(perf_df: pd.DataFrame, out_folder: str):
    os.makedirs(out_folder, exist_ok=True)
    # plot average comparisons per keyword by algorithm and case sensitivity
    if perf_df.empty:
        print("[WARN] No performance data to plot.")
        return
    summary = perf_df.groupby(["algorithm", "case_sensitive"])[["comparisons", "time_s"]].mean().reset_index()
    # comparisons
    fig1, ax1 = plt.subplots(figsize=(8,5))
    for algo in summary["algorithm"].unique():
        subset = summary[summary["algorithm"]==algo]
        ax1.plot(subset["case_sensitive"], subset["comparisons"], marker='o', label=algo)
    ax1.set_title("Average Comparisons by Algorithm and Case Sensitivity")
    ax1.set_xlabel("case_sensitive")
    ax1.set_ylabel("average comparisons")
    ax1.legend()
    fig1.tight_layout()
    fig1_path = os.path.join(out_folder, "avg_comparisons.png")
    fig1.savefig(fig1_path)
    plt.close(fig1)

    # time
    fig2, ax2 = plt.subplots(figsize=(8,5))
    for algo in summary["algorithm"].unique():
        subset = summary[summary["algorithm"]==algo]
        ax2.plot(subset["case_sensitive"], subset["time_s"], marker='o', label=algo)
    ax2.set_title("Average Time (s) by Algorithm and Case Sensitivity")
    ax2.set_xlabel("case_sensitive")
    ax2.set_ylabel("average time (s)")
    ax2.legend()
    fig2.tight_layout()
    fig2_path = os.path.join(out_folder, "avg_time.png")
    fig2.savefig(fig2_path)
    plt.close(fig2)
    print(f"[INFO] Plots saved to {fig1_path} and {fig2_path}")

    # Additional analysis: small vs large CVs and single vs multiple keywords
    try:
        perf_df = perf_df.copy()
        perf_df["cv_size_bucket"] = perf_df["cv_size_bytes"].apply(lambda b: "small" if b < 100*1024 else "large")

        size_summary = perf_df.groupby(["algorithm", "cv_size_bucket"])[["comparisons", "time_s"]].mean().reset_index()

        # plot by size bucket - time
        fig3, ax3 = plt.subplots(figsize=(8,5))
        for algo in size_summary["algorithm"].unique():
            subset = size_summary[size_summary["algorithm"]==algo]
            ax3.plot(subset["cv_size_bucket"], subset["time_s"], marker='o', label=algo)
        ax3.set_title("Avg Time by Algorithm and CV Size Bucket")
        ax3.set_xlabel("cv_size_bucket")
        ax3.set_ylabel("average time (s)")
        ax3.legend()
        fig3.tight_layout()
        fig3_path = os.path.join(out_folder, "avg_time_by_size.png")
        fig3.savefig(fig3_path)
        plt.close(fig3)

        # single vs multiple keyword jobs - comparisons
        kw_summary = perf_df.groupby(["algorithm", "keyword_mode"])[["comparisons", "time_s"]].mean().reset_index()
        fig4, ax4 = plt.subplots(figsize=(8,5))
        for algo in kw_summary["algorithm"].unique():
            subset = kw_summary[kw_summary["algorithm"]==algo]
            ax4.plot(subset["keyword_mode"], subset["comparisons"], marker='o', label=algo)
        ax4.set_title("Avg Comparisons by Algorithm and Keyword Mode")
        ax4.set_xlabel("keyword_mode")
        ax4.set_ylabel("average comparisons")
        ax4.legend()
        fig4.tight_layout()
        fig4_path = os.path.join(out_folder, "avg_comparisons_by_keyword_mode.png")
        fig4.savefig(fig4_path)
        plt.close(fig4)
        print(f"[INFO] Additional plots saved to {fig3_path} and {fig4_path}")
        # Save summaries
        size_summary.to_csv(os.path.join(out_folder, "summary_by_size.csv"), index=False)
        kw_summary.to_csv(os.path.join(out_folder, "summary_by_keyword_mode.csv"), index=False)
    except Exception as e:
        print(f"[WARN] Could not generate extended performance analysis: {e}")

def write_report(out_folder: str):
    """Write a concise markdown report covering the assignment deliverables."""
    try:
        report_path = os.path.join(out_folder, "REPORT.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("# CV Analyzer using String Matching Algorithms\n\n")
            f.write("## Introduction & Problem Definition\n")
            f.write("This system analyzes CVs using Brute Force, Rabin–Karp, and KMP to match job keywords and rank candidates.\n\n")
            f.write("## System Design & Flow\n")
            f.write("- Input: CV files (PDF/DOCX/TXT), job descriptions (JSON with mandatory/optional keywords).\n")
            f.write("- Processing: Text extraction, per-keyword search, scoring, metrics logging.\n")
            f.write("- Output: Matches, missing keywords, relevance, performance CSVs and charts.\n\n")
            f.write("### Flowchart (Mermaid)\n")
            f.write("```mermaid\nflowchart TD\nA[Start]-->B[Load jobs.json & CV files]\nB-->C[Extract text]\nC-->D{For each algorithm}\nD-->E[Search keywords]\nE-->F[Collect metrics]\nF-->G[Compute relevance]\nG-->H[Save results & plots]\nH-->I[Rank candidates]\nI-->J[Recommend algorithm]\nJ-->K[End]\n```\n\n")
            f.write("## Algorithms & Pseudocode\n")
            f.write("### Brute Force\n")
            f.write("```\nfor i in 0..n-m:\n  j = 0\n  while j < m and text[i+j] == pattern[j]: j++\n  if j == m: report match i\n```\n\n")
            f.write("### KMP\n")
            f.write("```\ncompute LPS for pattern\ni=0, j=0\nwhile i < n:\n  if text[i]==pattern[j]: i++, j++\n  else if j>0: j = lps[j-1] else: i++\n  if j==m: report match i-j; j = lps[j-1]\n```\n\n")
            f.write("### Rabin–Karp\n")
            f.write("```\ncompute hash(pattern), rolling hash(text[0..m-1])\nfor i in 0..n-m:\n  if hash equal: verify chars; if all equal -> match\n  roll hash to next window\n```\n\n")
            f.write("## Experimental Results & Analysis\n")
            f.write("See generated CSVs and plots: avg_comparisons.png, avg_time.png, avg_time_by_size.png, avg_comparisons_by_keyword_mode.png.\n")
            f.write("We observe trade-offs: KMP minimizes comparisons in adversarial cases; RK is fast on average but may incur collisions requiring verification; BF is simplest but slower on large texts.\n\n")
            f.write("## Conclusion & Recommendation\n")
            f.write("Recommended algorithm is printed in console based on lowest average time (ties by comparisons).\n")
            f.write("Future improvements: synonym expansion, phrase matching, section-aware parsing, parallel processing.\n")
        print(f"[INFO] Report written to {report_path}")
    except Exception as e:
        print(f"[WARN] Could not write report: {e}")

# -----------------------------
# CLI & orchestration
# -----------------------------
def parse_args():
    parser = argparse.ArgumentParser(description="CV Analyzer using BF, RK, KMP")
    parser.add_argument("--cvs", required=True, help="Folder containing CVs (.pdf, .docx, .txt)")
    parser.add_argument("--jobs", required=True, help="JSON file with job descriptions (mandatory/optional lists)")
    parser.add_argument("--out", default="./results", help="Output folder")
    parser.add_argument("--algos", default="bf,kmp,rk", help="Comma-separated algorithms to run: bf,kmp,rk")
    parser.add_argument("--case-sensitive", action="store_true", help="Enable case-sensitive matching (default: case-insensitive)")
    return parser.parse_args()

def load_jobs(json_path: str) -> Dict[str, Dict[str, List[str]]]:
    with open(json_path, "r", encoding="utf-8") as f:
        jobs = json.load(f)
    # Expecting { "Data Scientist": {"mandatory": [...], "optional": [...]}, ... }
    return jobs

def main():
    args = parse_args()
    jobs = load_jobs(args.jobs)
    algos = [a.strip() for a in args.algos.split(",") if a.strip()]
    all_perf_frames = []
    all_result_frames = []
    out_folder = args.out
    for algo in algos:
        print(f"[INFO] Running algorithm: {algo}")
        results_df, perf_df = process_all(args.cvs, jobs, algo, args.case_sensitive, out_folder)
        all_perf_frames.append(perf_df)
        all_result_frames.append(results_df)
    if all_perf_frames:
        combined = pd.concat(all_perf_frames, ignore_index=True)
        plot_performance(combined, out_folder)
        # Simple recommendation based on lowest average time, then comparisons
        agg = combined.groupby("algorithm")["time_s", "comparisons"].mean().reset_index()
        # Sort by time then comparisons
        agg = agg.sort_values(by=["time_s", "comparisons"], ascending=[True, True])
        best_algo = agg.iloc[0]["algorithm"] if not agg.empty else None
        if best_algo is not None:
            print(f"[INFO] Recommended algorithm for real-time screening: {best_algo} (lowest average time)")
    # Write concise report
    write_report(out_folder)
    print("[INFO] Done.")

if __name__ == "__main__":
    main()
