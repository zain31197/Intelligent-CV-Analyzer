#!/usr/bin/env python3
"""
Flask Backend for CV Analyzer
Provides REST API endpoints for CV analysis using BF, RK, and KMP algorithms
"""

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import os
import json
import tempfile
import time
from werkzeug.utils import secure_filename
from cv_analyzer import (
    load_cv_text,
    analyze_cv_text,
    search_keyword_with_algo,
    iterate_cvs
)
import re
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Ensure results/web dir exists for API outputs
RESULTS_DIR = os.path.join('results', 'web')
os.makedirs(RESULTS_DIR, exist_ok=True)
JOBS_FILE = 'jobs.json'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def _extract_contacts(text: str):
    email = None
    phone = None
    try:
        email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", text)
        if email_match:
            email = email_match.group(0)
    except Exception:
        pass
    try:
        phone_match = re.search(r"(\+?\d[\d\s\-()]{8,}\d)", text)
        if phone_match:
            phone = phone_match.group(0)
    except Exception:
        pass
    return email, phone

def _first_snippet(text: str, positions: list, window: int = 60):
    if not positions:
        return None
    pos = positions[0]
    start = max(0, pos - window)
    end = min(len(text), pos + window)
    return text[start:end]

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    """Return job descriptions from jobs.json as { titles: [...], jobs: {title: {...}} }"""
    try:
        if not os.path.exists(JOBS_FILE):
            return jsonify({'error': 'jobs.json not found'}), 404
        with open(JOBS_FILE, 'r', encoding='utf-8') as f:
            jobs = json.load(f)
        titles = list(jobs.keys())
        return jsonify({'titles': titles, 'jobs': jobs})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs', methods=['POST'])
def upsert_job():
    """Create or update a job in jobs.json. Body: {title, mandatory:[], optional:[]}"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        title = data.get('title')
        mandatory = data.get('mandatory', [])
        optional = data.get('optional', [])
        if not title:
            return jsonify({'error': 'title is required'}), 400
        jobs = {}
        if os.path.exists(JOBS_FILE):
            with open(JOBS_FILE, 'r', encoding='utf-8') as f:
                jobs = json.load(f)
        jobs[title] = { 'mandatory': mandatory, 'optional': optional }
        with open(JOBS_FILE, 'w', encoding='utf-8') as f:
            json.dump(jobs, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True, 'titles': list(jobs.keys())})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs/<path:title>', methods=['DELETE'])
def delete_job(title):
    """Delete a job from jobs.json by title"""
    try:
        if not os.path.exists(JOBS_FILE):
            return jsonify({'error': 'jobs.json not found'}), 404
        with open(JOBS_FILE, 'r', encoding='utf-8') as f:
            jobs = json.load(f)
        if title not in jobs:
            return jsonify({'error': 'Job not found'}), 404
        del jobs[title]
        with open(JOBS_FILE, 'w', encoding='utf-8') as f:
            json.dump(jobs, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True, 'titles': list(jobs.keys())})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    """Serve the frontend"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files (CSS, JS)"""
    return send_from_directory('.', filename)

@app.route('/cvs/<path:filename>')
def serve_cv(filename):
    """Serve CV files from cvs_folder"""
    # Handle URL encoding issues with spaces and special characters
    filename = filename.replace('%20', ' ')
    cv_path = os.path.join('cvs_folder', filename)
    
    if os.path.exists(cv_path):
        return send_file(cv_path)
    else:
        return jsonify({'error': 'CV not found'}), 404

@app.route('/api/analyze', methods=['POST'])
def analyze_cv():
    """
    Analyze a CV against job keywords
    Expects: multipart/form-data with 'cv' file, 'job_data' JSON, 'algorithm' and 'case_sensitive'
    Returns: analysis results with metrics
    """
    try:
        # Get the uploaded file
        if 'cv' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['cv']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Get algorithm and case sensitivity settings
        algorithm = request.form.get('algorithm', 'bf')
        case_sensitive = request.form.get('case_sensitive', 'false').lower() == 'true'
        
        # Parse job data
        job_data_str = request.form.get('job_data', '{}')
        try:
            job_data = json.loads(job_data_str)
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid job data JSON'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            # Extract text from CV
            cv_text = load_cv_text(filepath)
            
            if not cv_text.strip():
                return jsonify({'error': 'Could not extract text from CV'}), 400
            
            # Analyze CV
            results = []
            csv_rows = []
            timestamp = time.strftime('%Y%m%d_%H%M%S')
            
            # Process each job description
            for job_name, job_keywords in job_data.items():
                metrics = analyze_cv_text(cv_text, job_keywords, algorithm, case_sensitive)
                # contacts and snippet
                email, phone = _extract_contacts(cv_text)
                # gather first positions for snippet
                all_pos = []
                for m in metrics['per_keyword']:
                    if m.get('found') and m.get('positions'):
                        all_pos.extend(m['positions'])
                snippet = _first_snippet(cv_text, sorted(all_pos))
                # candidate fields
                candidate_id = f"{hash(filename)}"
                name = os.path.splitext(filename)[0]
                processed_at = datetime.now(timezone.utc).isoformat()
                
                result = {
                    'candidate_id': candidate_id,
                    'name': name,
                    'email': email,
                    'phone': phone,
                    'filename': file.filename,
                    'score': metrics.get('score', round(metrics['relevance_pct'], 2)),
                    'required_matched': len(metrics.get('matched_mandatory', [])),
                    'required_total': metrics.get('required_total', len(job_keywords.get('mandatory', []))),
                    'optional_matched': len(metrics.get('matched_optional', [])),
                    'optional_total': metrics.get('optional_total', len(job_keywords.get('optional', []))),
                    'matches': [
                        {
                            'keyword': m['keyword'],
                            'category': m.get('category'),
                            'positions': m.get('positions', []),
                            'algorithm': algorithm,
                            'count': m.get('occurrences', 0)
                        } for m in metrics['per_keyword'] if m.get('found')
                    ],
                    'per_keyword_metrics': metrics['per_keyword'],
                    'algorithms': {
                        algorithm: {
                            'time_ms': int(sum(pk['time_s'] for pk in metrics['per_keyword']) * 1000),
                            'comparisons': int(sum(pk['comparisons'] for pk in metrics['per_keyword'])),
                            'hash_collisions': int(sum(pk.get('collisions', 0) for pk in metrics['per_keyword']))
                        }
                    },
                    'processed_at': processed_at,
                    'snippet': snippet,
                    'job_name': job_name
                }
                results.append(result)

                csv_rows.append({
                    'cv': file.filename,
                    'job': job_name,
                    'algorithm': algorithm,
                    'case_sensitive': case_sensitive,
                    'matched_mandatory': ';'.join(metrics['matched_mandatory']),
                    'matched_optional': ';'.join(metrics['matched_optional']),
                    'missing_mandatory': ';'.join(metrics.get('missing_mandatory', [])),
                    'missing_optional': ';'.join(metrics.get('missing_optional', [])),
                    'relevance_pct': metrics['relevance_pct']
                })
            
            # Persist a small CSV summary for this request
            try:
                out_csv = os.path.join(RESULTS_DIR, f'matches_web_{algorithm}_{"cs" if case_sensitive else "ci"}_{timestamp}.csv')
                import pandas as pd  # lazy import for web-only path
                pd.DataFrame(csv_rows).to_csv(out_csv, index=False)
            except Exception:
                pass
            
            return jsonify({
                'success': True,
                'results': results
            })
        
        finally:
            # Clean up uploaded file
            if os.path.exists(filepath):
                os.remove(filepath)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare', methods=['POST'])
def compare_algorithms():
    """
    Compare all algorithms on a CV
    Expects: multipart/form-data with 'cv' file, 'job_data' JSON, 'case_sensitive'
    Returns: comparison results for all algorithms
    """
    try:
        if 'cv' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['cv']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type'}), 400
        
        case_sensitive = request.form.get('case_sensitive', 'false').lower() == 'true'
        job_data_str = request.form.get('job_data', '{}')
        
        try:
            job_data = json.loads(job_data_str)
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid job data JSON'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            # Extract text from CV
            cv_text = load_cv_text(filepath)
            
            if not cv_text.strip():
                return jsonify({'error': 'Could not extract text from CV'}), 400
            
            comparison_results = []
            algorithms = ['bf', 'kmp', 'rk']
            
            # Get first job description for comparison
            first_job = next(iter(job_data.items()))
            job_name, job_keywords = first_job
            
            perf_rows = []
            timestamp = time.strftime('%Y%m%d_%H%M%S')
            
            for algo in algorithms:
                metrics = analyze_cv_text(cv_text, job_keywords, algo, case_sensitive)
                
                # Calculate average performance metrics
                total_comparisons = sum(m['comparisons'] for m in metrics['per_keyword'])
                total_time = sum(m['time_s'] for m in metrics['per_keyword'])
                total_collisions = sum(m.get('collisions', 0) for m in metrics['per_keyword'])
                
                result = {
                    'algorithm': algo,
                    'required_matched': len(metrics['matched_mandatory']),
                    'required_total': metrics.get('required_total', len(job_keywords.get('mandatory', []))),
                    'optional_matched': len(metrics['matched_optional']),
                    'optional_total': metrics.get('optional_total', len(job_keywords.get('optional', []))),
                    'score': metrics.get('score', round(metrics['relevance_pct'], 2)),
                    'total_comparisons': int(total_comparisons),
                    'total_time_ms': int(total_time * 1000),
                    'total_collisions': int(total_collisions),
                    'per_keyword': metrics['per_keyword']
                }
                comparison_results.append(result)

                perf_rows.append({
                    'cv': file.filename,
                    'job': job_name,
                    'algorithm': algo,
                    'case_sensitive': case_sensitive,
                    'matched_mandatory': len(metrics['matched_mandatory']),
                    'matched_optional': len(metrics['matched_optional']),
                    'relevance_pct': metrics['relevance_pct'],
                    'total_comparisons': total_comparisons,
                    'total_time_s': total_time,
                    'total_collisions': total_collisions
                })
            
            # Save a performance CSV for this request
            try:
                out_csv = os.path.join(RESULTS_DIR, f'compare_web_{"cs" if case_sensitive else "ci"}_{timestamp}.csv')
                import pandas as pd
                pd.DataFrame(perf_rows).to_csv(out_csv, index=False)
            except Exception:
                pass
            
            return jsonify({
                'success': True,
                'candidate': {
                    'filename': file.filename,
                    'processed_at': datetime.now(timezone.utc).isoformat(),
                    'job_name': job_name
                },
                'algorithms': comparison_results
            })
        
        finally:
            # Clean up uploaded file
            if os.path.exists(filepath):
                os.remove(filepath)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch-analyze', methods=['POST'])
def batch_analyze():
    """
    Analyze all CVs in the cvs_folder directory
    Expects: JSON with 'job_data', 'algorithm', and 'case_sensitive'
    Returns: analysis results for all CVs
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        job_data = data.get('job_data', {})
        algorithm = data.get('algorithm', 'bf')
        case_sensitive = data.get('case_sensitive', False)
        cv_folder = data.get('cv_folder', 'cvs_folder')
        
        if not os.path.exists(cv_folder):
            return jsonify({'error': f'CV folder "{cv_folder}" not found'}), 400
        
        # Get all CVs
        cv_files = iterate_cvs(cv_folder)
        
        if not cv_files:
            return jsonify({'error': 'No CV files found in the folder'}), 400
        
        results = []
        errors = []
        start_time = time.perf_counter()
        csv_rows = []
        timestamp = time.strftime('%Y%m%d_%H%M%S')
        
        for cv_path in cv_files:
            try:
                # Extract text from CV
                cv_text = load_cv_text(cv_path)
                
                if not cv_text.strip():
                    errors.append(f"No text extracted from {os.path.basename(cv_path)}")
                    continue
                
                # Process each job description
                for job_name, job_keywords in job_data.items():
                    metrics = analyze_cv_text(cv_text, job_keywords, algorithm, case_sensitive)
                    
                    result = {
                        'cv_name': os.path.basename(cv_path),
                        'job_name': job_name,
                        'matched_mandatory': metrics['matched_mandatory'],
                        'matched_optional': metrics['matched_optional'],
                        'missing_mandatory': metrics.get('missing_mandatory', []),
                        'missing_optional': metrics.get('missing_optional', []),
                        'relevance_pct': round(metrics['relevance_pct'], 2),
                        'mandatory_count': len(job_keywords.get('mandatory', [])),
                        'optional_count': len(job_keywords.get('optional', [])),
                        'matched_mandatory_count': len(metrics['matched_mandatory']),
                        'matched_optional_count': len(metrics['matched_optional'])
                    }
                    results.append(result)

                    csv_rows.append({
                        'cv': os.path.basename(cv_path),
                        'job': job_name,
                        'algorithm': algorithm,
                        'case_sensitive': case_sensitive,
                        'matched_mandatory': ';'.join(metrics.get('matched_mandatory', [])),
                        'matched_optional': ';'.join(metrics.get('matched_optional', [])),
                        'missing_mandatory': ';'.join(metrics.get('missing_mandatory', [])),
                        'missing_optional': ';'.join(metrics.get('missing_optional', [])),
                        'relevance_pct': metrics.get('relevance_pct', 0.0)
                    })
            
            except Exception as e:
                errors.append(f"Error processing {os.path.basename(cv_path)}: {str(e)}")
        
        end_time = time.perf_counter()
        processing_time = round(end_time - start_time, 3)
        
        # Persist batch results CSV
        try:
            out_csv = os.path.join(RESULTS_DIR, f'batch_matches_web_{algorithm}_{"cs" if case_sensitive else "ci"}_{timestamp}.csv')
            import pandas as pd
            pd.DataFrame(csv_rows).to_csv(out_csv, index=False)
        except Exception:
            pass
        
        # Calculate matched CVs (relevance > 0)
        matched_cvs = len([r for r in results if r['relevance_pct'] > 0])
        
        return jsonify({
            'success': True,
            'total_cvs': len(cv_files),
            'processed': len(results),
            'matched_cvs': matched_cvs,
            'processing_time_seconds': processing_time,
            'algorithm': algorithm,
            'case_sensitive': case_sensitive,
            'results': results,
            'errors': errors
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch-compare', methods=['POST'])
def batch_compare():
    """
    Compare all algorithms on all CVs in the cvs_folder
    Expects: JSON with 'job_data' and 'case_sensitive'
    Returns: comparison results for all CVs
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        job_data = data.get('job_data', {})
        case_sensitive = data.get('case_sensitive', False)
        cv_folder = data.get('cv_folder', 'cvs_folder')
        
        if not os.path.exists(cv_folder):
            return jsonify({'error': f'CV folder "{cv_folder}" not found'}), 400
        
        # Get all CVs
        cv_files = iterate_cvs(cv_folder)
        
        if not cv_files:
            return jsonify({'error': 'No CV files found in the folder'}), 400
        
        # Get first job description
        first_job = next(iter(job_data.items()))
        job_name, job_keywords = first_job
        
        all_results = []
        errors = []
        start_time = time.perf_counter()
        perf_rows = []
        timestamp = time.strftime('%Y%m%d_%H%M%S')
        
        for cv_path in cv_files:
            try:
                # Extract text from CV
                cv_text = load_cv_text(cv_path)
                
                if not cv_text.strip():
                    continue
                
                cv_result = {
                    'cv_name': os.path.basename(cv_path),
                    'job_name': job_name,
                    'algorithms': []
                }
                
                # Test each algorithm
                algorithms = ['bf', 'kmp', 'rk']
                for algo in algorithms:
                    metrics = analyze_cv_text(cv_text, job_keywords, algo, case_sensitive)
                    
                    # Calculate totals
                    total_comparisons = sum(m['comparisons'] for m in metrics['per_keyword'])
                    total_time = sum(m['time_s'] for m in metrics['per_keyword'])
                    total_collisions = sum(m.get('collisions', 0) for m in metrics['per_keyword'])
                    
                    algo_result = {
                        'algorithm': algo,
                        'relevance_pct': round(metrics['relevance_pct'], 2),
                        'matched_mandatory': metrics['matched_mandatory'],
                        'matched_optional': metrics['matched_optional'],
                        'missing_mandatory': metrics.get('missing_mandatory', []),
                        'missing_optional': metrics.get('missing_optional', []),
                        'matched_mandatory_count': len(metrics['matched_mandatory']),
                        'matched_optional_count': len(metrics['matched_optional']),
                        'mandatory_count': metrics.get('required_total', len(job_keywords.get('mandatory', []))),
                        'optional_count': metrics.get('optional_total', len(job_keywords.get('optional', []))),
                        'total_comparisons': total_comparisons,
                        'total_time_s': round(total_time, 6),
                        'total_collisions': total_collisions
                    }
                    cv_result['algorithms'].append(algo_result)

                    perf_rows.append({
                        'cv': os.path.basename(cv_path),
                        'job': job_name,
                        'algorithm': algo,
                        'case_sensitive': case_sensitive,
                        'relevance_pct': metrics['relevance_pct'],
                        'matched_mandatory': len(metrics['matched_mandatory']),
                        'matched_optional': len(metrics['matched_optional']),
                        'total_comparisons': total_comparisons,
                        'total_time_s': total_time,
                        'total_collisions': total_collisions
                    })
                
                all_results.append(cv_result)
            
            except Exception as e:
                errors.append(f"Error processing {os.path.basename(cv_path)}: {str(e)}")
        
        end_time = time.perf_counter()
        processing_time = round(end_time - start_time, 3)
        
        # Persist batch comparison performance CSV
        try:
            out_csv = os.path.join(RESULTS_DIR, f'batch_compare_web_{"cs" if case_sensitive else "ci"}_{timestamp}.csv')
            import pandas as pd
            pd.DataFrame(perf_rows).to_csv(out_csv, index=False)
        except Exception:
            pass
        
        # Calculate matched CVs (at least one algorithm found match)
        matched_cvs = len([r for r in all_results if any(a['relevance_pct'] > 0 for a in r['algorithms'])])
        
        return jsonify({
            'success': True,
            'total_cvs': len(cv_files),
            'processed': len(all_results),
            'matched_cvs': matched_cvs,
            'processing_time_seconds': processing_time,
            'job_name': job_name,
            'case_sensitive': case_sensitive,
            'results': all_results,
            'errors': errors
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export', methods=['POST'])
def export_results():
    """Export provided rows in requested format (csv or json). Body: { rows: [...], format: 'csv'|'json', filename?: 'name' }"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        rows = data.get('rows', [])
        fmt = data.get('format', 'csv').lower()
        filename = data.get('filename', f'export_{time.strftime('%Y%m%d_%H%M%S')}')
        if fmt not in ('csv', 'json'):
            return jsonify({'error': 'Unsupported format'}), 400
        if fmt == 'json':
            from flask import Response
            import json as _json
            blob = _json.dumps(rows, ensure_ascii=False).encode('utf-8')
            return Response(blob, mimetype='application/json', headers={'Content-Disposition': f'attachment; filename={filename}.json'})
        else:
            import pandas as pd
            df = pd.DataFrame(rows)
            out_path = os.path.join(RESULTS_DIR, f'{filename}.csv')
            df.to_csv(out_path, index=False)
            return send_file(out_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/data-analysis', methods=['GET'])
def data_analysis():
    """Aggregate simple stats from the most recent batch CSVs in results/web."""
    try:
        import glob
        import pandas as pd
        match_files = sorted(glob.glob(os.path.join(RESULTS_DIR, 'batch_matches_web_*.csv')))
        compare_files = sorted(glob.glob(os.path.join(RESULTS_DIR, 'batch_compare_web_*.csv')))
        batches = len(match_files)
        if batches == 0:
            return jsonify({'batches': 0, 'total_rows': 0, 'avg_score': 0, 'best_algorithm': None, 'top_by_job': {}})
        # Use last matches file for per-job ranking
        last_match = match_files[-1]
        df = pd.read_csv(last_match)
        total_rows = len(df)
        avg_score = float(pd.to_numeric(df.get('relevance_pct', 0), errors='coerce').fillna(0).mean())
        # Top by job
        top_by_job = {}
        if 'job' in df.columns:
            for job, group in df.groupby('job'):
                ranked = group.sort_values(by='relevance_pct', ascending=False).head(5)
                top_by_job[job] = [{'cv': r['cv'], 'relevance_pct': float(r['relevance_pct'])} for _, r in ranked.iterrows()]
        # Best algorithm from last compare file (by lowest avg time)
        best_algorithm = None
        if compare_files:
            comp = pd.read_csv(compare_files[-1])
            if 'algorithm' in comp.columns and 'total_time_s' in comp.columns:
                agg = comp.groupby('algorithm')['total_time_s'].mean().sort_values()
                if not agg.empty:
                    best_algorithm = agg.index[0].upper()
        return jsonify({
            'batches': batches,
            'total_rows': int(total_rows),
            'avg_score': round(avg_score, 2),
            'best_algorithm': best_algorithm,
            'top_by_job': top_by_job
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

