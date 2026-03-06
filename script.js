// Tab switching
function switchTab(tab) {
    // Update tab buttons - find button by text content or data attribute
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        const btnText = btn.textContent.toLowerCase();
        if ((tab === 'home' && btnText.includes('home')) ||
            (tab === 'single' && btnText.includes('single')) ||
            (tab === 'compare' && btnText.includes('compare') && !btnText.includes('batch')) ||
            (tab === 'batch' && btnText.includes('batch') && !btnText.includes('compare')) ||
            (tab === 'batch-compare' && btnText.includes('batch compare')) ||
            (tab === 'jobs' && btnText.includes('job'))) {
            btn.classList.add('active');
        }
    });
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // Show selected tab
    if (tab === 'home') {
        document.getElementById('home-tab').classList.add('active');
    } else if (tab === 'single') {
        document.getElementById('single-tab').classList.add('active');
    } else if (tab === 'compare') {
        document.getElementById('compare-tab').classList.add('active');
    } else if (tab === 'batch') {
        document.getElementById('batch-tab').classList.add('active');
    } else if (tab === 'batch-compare') {
        document.getElementById('batch-compare-tab').classList.add('active');
    } else if (tab === 'jobs') {
        document.getElementById('jobs-tab').classList.add('active');
        listJobs();
        updateFormUI(); // Ensure form UI is correct when switching to jobs tab
    }
    
    // Clear results
    const resIds = ['results','compareResults','batchResults','batchCompareResults'];
    resIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active'); el.innerHTML = ''; }
    });
}

// File upload handling - Single
const cvFileInput = document.getElementById('cvFile');
const fileUploadArea = document.getElementById('fileUploadArea');
const fileName = document.getElementById('fileName');

cvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileName.textContent = e.target.files[0].name;
        fileName.style.display = 'block';
    }
});

fileUploadArea.addEventListener('click', () => {
    cvFileInput.click();
});

fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = '#6366f1';
    fileUploadArea.style.background = 'rgba(99, 102, 241, 0.1)';
});

fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.style.borderColor = '';
    fileUploadArea.style.background = '';
});

fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = '';
    fileUploadArea.style.background = '';
    
    if (e.dataTransfer.files.length > 0) {
        cvFileInput.files = e.dataTransfer.files;
        fileName.textContent = e.dataTransfer.files[0].name;
        fileName.style.display = 'block';
    }
});

// File upload handling - Compare
const compareCvFileInput = document.getElementById('compareCvFile');
const compareFileUploadArea = document.getElementById('compareFileUploadArea');
const compareFileName = document.getElementById('compareFileName');

compareCvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        compareFileName.textContent = e.target.files[0].name;
        compareFileName.style.display = 'block';
    }
});

compareFileUploadArea.addEventListener('click', () => {
    compareCvFileInput.click();
});

compareFileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    compareFileUploadArea.style.borderColor = '#6366f1';
    compareFileUploadArea.style.background = 'rgba(99, 102, 241, 0.1)';
});

compareFileUploadArea.addEventListener('dragleave', () => {
    compareFileUploadArea.style.borderColor = '';
    compareFileUploadArea.style.background = '';
});

compareFileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    compareFileUploadArea.style.borderColor = '';
    compareFileUploadArea.style.background = '';
    
    if (e.dataTransfer.files.length > 0) {
        compareCvFileInput.files = e.dataTransfer.files;
        compareFileName.textContent = e.dataTransfer.files[0].name;
        compareFileName.style.display = 'block';
    }
});

let JOBS = {};
function populateJobSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    const titles = Object.keys(JOBS);
    titles.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        sel.appendChild(opt);
    });
}
async function loadJobs() {
    try {
        const resp = await fetch('/api/jobs');
        const data = await resp.json();
        if (data && data.jobs) {
            JOBS = data.jobs;
            ['singleJobSelect','compareJobSelect','batchJobSelect','batchCompareJobSelect'].forEach(populateJobSelect);
        }
    } catch (_) {}
}

// Analyze CV with single algorithm
async function analyzeCV() {
    const fileInput = document.getElementById('cvFile');
    const algorithm = document.getElementById('algorithm').value;
    const caseSensitive = document.getElementById('caseSensitive').value;
    const jobTitle = document.getElementById('singleJobSelect').value;

    if (!fileInput.files || fileInput.files.length === 0) { showError('Please upload a CV file.'); return; }
    if (!jobTitle || !JOBS[jobTitle]) { showError('Please select a job title.'); return; }

    const jobData = { [jobTitle]: JOBS[jobTitle] };
    
    // Prepare form data
    const formData = new FormData();
    formData.append('cv', fileInput.files[0]);
    formData.append('job_data', JSON.stringify(jobData));
    formData.append('algorithm', algorithm);
    formData.append('case_sensitive', caseSensitive);
    
    // Show loading
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = 'Analyzing... <span class="loading"></span>';
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            displayResults(data.results[0], document.getElementById('results'));
        }
    } catch (error) {
        showError('An error occurred: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Compare all algorithms
async function compareAlgorithms() {
    const fileInput = document.getElementById('compareCvFile');
    const caseSensitive = document.getElementById('compareCaseSensitive').value;
    const jobTitle = document.getElementById('compareJobSelect').value;
    if (!fileInput.files || fileInput.files.length === 0) { showError('Please upload a CV file.'); return; }
    if (!jobTitle || !JOBS[jobTitle]) { showError('Please select a job title.'); return; }
    const jobData = { [jobTitle]: JOBS[jobTitle] };
    
    // Prepare form data
    const formData = new FormData();
    formData.append('cv', fileInput.files[0]);
    formData.append('job_data', JSON.stringify(jobData));
    formData.append('case_sensitive', caseSensitive);
    
    // Show loading
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = 'Comparing... <span class="loading"></span>';
    
    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            displayComparisonResults(data);
        }
    } catch (error) {
        showError('An error occurred: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Display results for single algorithm
function displayResults(result, container) {
    container.classList.add('active');
    container.innerHTML = '';

    // Normalize fields from either legacy or new API
    const score = typeof result.score === 'number' ? result.score : (typeof result.relevance_pct === 'number' ? result.relevance_pct : 0);
    const matchedMandatory = Array.isArray(result.matched_mandatory) ? result.matched_mandatory : [];
    const matchedOptional = Array.isArray(result.matched_optional) ? result.matched_optional : [];
    const missingMandatory = Array.isArray(result.missing_mandatory) ? result.missing_mandatory : [];
    const missingOptional = Array.isArray(result.missing_optional) ? result.missing_optional : [];
    const reqMatched = typeof result.required_matched === 'number' ? result.required_matched : matchedMandatory.length;
    const reqTotal = typeof result.required_total === 'number' ? result.required_total : (reqMatched + missingMandatory.length);
    const optMatched = typeof result.optional_matched === 'number' ? result.optional_matched : matchedOptional.length;
    const optTotal = typeof result.optional_total === 'number' ? result.optional_total : (optMatched + missingOptional.length);
    const perKeyword = Array.isArray(result.per_keyword_metrics) ? result.per_keyword_metrics : (Array.isArray(result.matches) ? result.matches.map(m => ({
        keyword: m.keyword,
        category: (matchedMandatory.includes(m.keyword) ? 'mandatory' : (matchedOptional.includes(m.keyword) ? 'optional' : 'unknown')),
        found: true,
        occurrences: m.count || (m.positions ? m.positions.length : 1),
        comparisons: m.comparisons || 0,
        time_s: (m.time_ms ? m.time_ms/1000 : 0),
        collisions: m.hash_collisions || 0
    })) : []);

    const colorClass = score >= 80 ? 'success' : (score >= 60 ? 'warning' : 'danger');

    let html = `
        <div class="result-card">
            <h3>Analysis Results</h3>
            <div class="metrics-grid">
                <div class="metric-card ${colorClass}">
                    <div class="metric-label">Relevance Score</div>
                    <div class="metric-value">${score}%</div>
                </div>
                <div class="metric-card success">
                    <div class="metric-label">Mandatory Matched</div>
                    <div class="metric-value">${reqMatched}/${reqTotal}</div>
                </div>
                <div class="metric-card warning">
                    <div class="metric-label">Optional Matched</div>
                    <div class="metric-value">${optMatched}/${optTotal}</div>
                </div>
            </div>
    `;

    // Matched/missing lists
    html += '<div class="keywords-section">';
    if (matchedMandatory.length || matchedOptional.length) {
        html += '<h4>Matched Keywords</h4>';
        if (matchedMandatory.length) {
            html += '<div><strong>Mandatory:</strong> ' + matchedMandatory.map(kw => `<span class="keyword-tag mandatory found">${kw}</span>`).join(' ') + '</div>';
        }
        if (matchedOptional.length) {
            html += '<div><strong>Optional:</strong> ' + matchedOptional.map(kw => `<span class="keyword-tag optional found">${kw}</span>`).join(' ') + '</div>';
        }
    }
    if (missingMandatory.length || missingOptional.length) {
        html += '<h4 style="margin-top:10px;">Missing Keywords</h4>';
        if (missingMandatory.length) {
            html += '<div><strong>Mandatory:</strong> ' + missingMandatory.map(kw => `<span class="keyword-tag mandatory">${kw}</span>`).join(' ') + '</div>';
        }
        if (missingOptional.length) {
            html += '<div><strong>Optional:</strong> ' + missingOptional.map(kw => `<span class="keyword-tag optional">${kw}</span>`).join(' ') + '</div>';
        }
    }
    html += '</div>';

    // Performance table if present
    if (perKeyword.length) {
        html += `
            <div class="keywords-section">
                <h4>Performance Metrics</h4>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Keyword</th>
                            <th>Category</th>
                            <th>Found</th>
                            <th>Occurrences</th>
                            <th>Comparisons</th>
                            <th>Time (s)</th>
                            <th>Collisions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        perKeyword.forEach(metric => {
            html += `
                <tr>
                    <td><strong>${metric.keyword}</strong></td>
                    <td><span class="keyword-tag ${metric.category || ''}">${metric.category || '-'}</span></td>
                    <td>${metric.found ? '✓' : '✗'}</td>
                    <td>${metric.occurrences ?? 0}</td>
                    <td>${(metric.comparisons ?? 0).toLocaleString()}</td>
                    <td>${(metric.time_s ?? 0).toFixed ? (metric.time_s).toFixed(6) : Number(metric.time_s || 0).toFixed(6)}</td>
                    <td>${metric.collisions ?? 0}</td>
                </tr>
            `;
        });
        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    html += '</div>';

    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display comparison results for all algorithms
function displayComparisonResults(data) {
    const container = document.getElementById('compareResults');
    container.classList.add('active');
    container.innerHTML = '';
    
    let html = `
        <div class="result-card">
            <h3>Algorithm Comparison Results</h3>
            <p><strong>CV:</strong> ${(data.cv_name || (data.candidate && data.candidate.filename) || '')} | <strong>Job:</strong> ${(data.job_name || (data.candidate && data.candidate.job_name) || '')}</p>
            
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Algorithm</th>
                        <th>Relevance (%)</th>
                        <th>Mandatory</th>
                        <th>Optional</th>
                        <th>Total Comparisons</th>
                        <th>Total Time (s)</th>
                        <th>Collisions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    (data.algorithms || []).forEach(algo => {
        const rel = Number(algo.relevance_pct ?? algo.score ?? 0);
        const color = rel >= 70 ? '#10b981' : rel >= 40 ? '#f59e0b' : '#ef4444';
        const req = Number(algo.required_matched ?? algo.matched_mandatory ?? 0);
        const opt = Number(algo.optional_matched ?? algo.matched_optional ?? 0);
        const comps = Number(algo.total_comparisons ?? 0);
        const timeS = Number(algo.total_time_s ?? (algo.total_time_ms ? algo.total_time_ms/1000 : 0));
        const colls = Number(algo.total_collisions ?? 0);
        html += `
            <tr>
                <td><strong>${(algo.algorithm || '').toUpperCase()}</strong></td>
                <td><span style="font-weight:700; color:${color}">${rel}%</span></td>
                <td>${req}</td>
                <td>${opt}</td>
                <td>${comps.toLocaleString()}</td>
                <td>${timeS.toFixed(6)}</td>
                <td>${colls}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Matched/missing keywords per algorithm
    if ((data.algorithms || []).length) {
        html += '<div class="result-card"><h3>Matched Keywords by Algorithm</h3>';
        (data.algorithms || []).forEach(algo => {
            const list = Array.isArray(algo.per_keyword) ? algo.per_keyword : [];
            const matchedMand = list.filter(k => k.category === 'mandatory' && k.found).map(k => k.keyword);
            const matchedOpt = list.filter(k => k.category === 'optional' && k.found).map(k => k.keyword);
            const allMand = list.filter(k => k.category === 'mandatory').map(k => k.keyword);
            const allOpt = list.filter(k => k.category === 'optional').map(k => k.keyword);
            const missingMand = allMand.filter(kw => !matchedMand.includes(kw));
            const missingOpt = allOpt.filter(kw => !matchedOpt.includes(kw));
            html += `
                <div style="margin-top:10px;">
                    <h4 style="margin-bottom:6px;">${(algo.algorithm || '').toUpperCase()}</h4>
                    <div style="margin-bottom:6px;"><strong>Mandatory Matched:</strong> ${matchedMand.length ? matchedMand.map(kw => `<span class="keyword-tag mandatory found">${kw}</span>`).join(' ') : '<span style="color:var(--text-secondary);">None</span>'}</div>
                    <div style="margin-bottom:6px;"><strong>Mandatory Missing:</strong> ${missingMand.length ? missingMand.map(kw => `<span class="keyword-tag mandatory">${kw}</span>`).join(' ') : '<span style="color:var(--text-secondary);">None</span>'}</div>
                    <div style="margin-bottom:6px;"><strong>Optional Matched:</strong> ${matchedOpt.length ? matchedOpt.map(kw => `<span class="keyword-tag optional found">${kw}</span>`).join(' ') : '<span style="color:var(--text-secondary);">None</span>'}</div>
                    <div><strong>Optional Missing:</strong> ${missingOpt.length ? missingOpt.map(kw => `<span class="keyword-tag optional">${kw}</span>`).join(' ') : '<span style="color:var(--text-secondary);">None</span>'}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Find the best algorithm
    const bestAlgo = (data.algorithms || []).reduce((best, current) => 
        (Number(current.relevance_pct ?? current.score ?? 0) > Number(best.relevance_pct ?? best.score ?? 0) ? current : best),
        (data.algorithms || [])[0] || { relevance_pct: 0 }
    );
    
    html += `
        <div class="result-card">
            <h3>Performance Summary</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Fastest Algorithm</div>
                    <div class="metric-value">${
                        (data.algorithms || []).reduce((min, curr) => 
                            (Number(curr.total_time_s ?? 0) < Number(min.total_time_s ?? 0) ? curr : min),
                            (data.algorithms || [])[0] || { algorithm: '' }
                        ).algorithm.toUpperCase()
                    }</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Least Comparisons</div>
                    <div class="metric-value">${
                        (data.algorithms || []).reduce((min, curr) => 
                            (Number(curr.total_comparisons ?? 0) < Number(min.total_comparisons ?? 0) ? curr : min),
                            (data.algorithms || [])[0] || { algorithm: '' }
                        ).algorithm.toUpperCase()
                    }</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Best Match</div>
                    <div class="metric-value">${(bestAlgo.algorithm || '').toUpperCase()}</div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show error message
function showError(message) {
    const resultsContainer = document.getElementById('results');
    const compareResultsContainer = document.getElementById('compareResults');
    
    resultsContainer.classList.add('active');
    resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
    
    compareResultsContainer.classList.add('active');
    compareResultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

// Batch analyze all CVs
async function analyzeBatch() {
    const algorithm = document.getElementById('batchAlgorithm').value;
    const caseSensitive = document.getElementById('batchCaseSensitive').value === 'true';
    const jobTitle = document.getElementById('batchJobSelect').value;
    if (!jobTitle || !JOBS[jobTitle]) { showError('Please select a job title.'); return; }
    const jobData = { [jobTitle]: JOBS[jobTitle] };
    
    const requestData = {
        job_data: jobData,
        algorithm: algorithm,
        case_sensitive: caseSensitive,
        cv_folder: 'cvs_folder'
    };
    
    // Show loading
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = 'Analyzing All CVs... <span class="loading"></span>';
    
    try {
        const response = await fetch('/api/batch-analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            displayBatchResults(data);
        }
    } catch (error) {
        showError('An error occurred: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Compare all algorithms on all CVs
async function compareBatch() {
    const caseSensitive = document.getElementById('batchCompareCaseSensitive').value === 'true';
    const jobTitle = document.getElementById('batchCompareJobSelect').value;
    if (!jobTitle || !JOBS[jobTitle]) { showError('Please select a job title.'); return; }
    const jobData = { [jobTitle]: JOBS[jobTitle] };
    
    const requestData = {
        job_data: jobData,
        case_sensitive: caseSensitive,
        cv_folder: 'cvs_folder'
    };
    
    // Show loading
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = 'Comparing All CVs... <span class="loading"></span>';
    
    try {
        const response = await fetch('/api/batch-compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            displayBatchCompareResults(data);
        }
    } catch (error) {
        showError('An error occurred: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Display batch analysis results
function displayBatchResults(data) {
    const container = document.getElementById('batchResults');
    container.classList.add('active');
    container.innerHTML = '';

    // Clone and enrich data for view
    let rows = (data.results || []).map((r) => ({
        cv_name: r.cv_name,
        job_name: r.job_name || 'Job',
        relevance_pct: r.relevance_pct || 0,
        matched_mandatory: Array.isArray(r.matched_mandatory) ? r.matched_mandatory : [],
        matched_optional: Array.isArray(r.matched_optional) ? r.matched_optional : [],
        missing_mandatory: Array.isArray(r.missing_mandatory) ? r.missing_mandatory : [],
        missing_optional: Array.isArray(r.missing_optional) ? r.missing_optional : [],
        matched_keywords: [...(r.matched_mandatory || []), ...(r.matched_optional || [])],
        missing_keywords: [...(r.missing_mandatory || []), ...(r.missing_optional || [])],
        matched_mandatory_count: r.matched_mandatory_count || 0,
        mandatory_count: r.mandatory_count || 0,
        matched_optional_count: r.matched_optional_count || 0,
        optional_count: r.optional_count || 0
    }));

    // Group by job
    const jobToRows = rows.reduce((acc, r) => {
        acc[r.job_name] = acc[r.job_name] || [];
        acc[r.job_name].push(r);
        return acc;
    }, {});

    // Default sort by relevance desc
    rows.sort((a, b) => b.relevance_pct - a.relevance_pct);

    const summaryHtml = `
        <div class="result-card">
            <h3>Batch Analysis Results</h3>
            <div class="metrics-grid">
                <div class="metric-card"><div class="metric-label">Total CVs</div><div class="metric-value">${data.total_cvs}</div></div>
                <div class="metric-card success"><div class="metric-label">Matched CVs</div><div class="metric-value">${data.matched_cvs || 0} / ${data.total_cvs}</div></div>
                <div class="metric-card success"><div class="metric-label">Processing Time</div><div class="metric-value">${data.processing_time_seconds || 0}s</div></div>
                <div class="metric-card"><div class="metric-label">Algorithm</div><div class="metric-value">${(data.algorithm || '').toUpperCase()}</div></div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
                <input id="batchSearch" placeholder="Search by name or keyword..." style="flex:1; padding:10px; border:1px solid var(--border-color); border-radius:8px;" />
                <button id="exportCsv" class="analyze-btn" style="width:auto; padding:10px 16px;">Export CSV</button>
                <button id="exportJson" class="analyze-btn" style="width:auto; padding:10px 16px;">Export JSON</button>
            </div>

            <h4 style="margin-top: 24px;">Top Candidates by Job</h4>
            <div id="topByJob" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:12px; margin-top:8px;"></div>

            <div style="overflow:auto;">
                <table id="batchTable" class="comparison-table" style="margin-top:15px;">
                    <thead>
                        <tr>
                            <th data-sort="rank">Rank</th>
                            <th data-sort="cv">Candidate Name</th>
                            <th>Job</th>
                            <th>Matched Keywords</th>
                            <th>Missing Keywords</th>
                            <th data-sort="score">Relevance</th>
                            <th>Algorithm Used</th>
                            <th>Time (ms)</th>
                            <th>Comparisons</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>`;

    container.innerHTML = summaryHtml;

    const topByJobEl = container.querySelector('#topByJob');

    // Render top 3 per job
    Object.keys(jobToRows).forEach(job => {
        const top3 = jobToRows[job].slice().sort((a,b)=>b.relevance_pct-a.relevance_pct).slice(0,3);
        const items = top3.map((r, i) => {
            const color = r.relevance_pct >= 80 ? '#10b981' : r.relevance_pct >= 60 ? '#f59e0b' : '#ef4444';
            const encoded = encodeURIComponent(r.cv_name);
            return `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background: var(--bg-color); border-radius:8px; margin-top:6px;">
                <div style="display:flex; gap:8px; align-items:center;"><span style="font-weight:700; width:20px; text-align:center;">${i+1}</span><a href="/cvs/${encoded}" target="_blank" style="color: var(--primary-color); text-decoration:none;">${r.cv_name}</a></div>
                <span style="font-weight:700; color:${color}">${r.relevance_pct}%</span>
            </div>`;
        }).join('');
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `<h4 style="margin-bottom:6px;">${job}</h4>${items || '<div style="color:var(--text-secondary);">No candidates</div>'}`;
        topByJobEl.appendChild(card);
    });

    const tbody = container.querySelector('#batchTable tbody');
    const searchInput = container.querySelector('#batchSearch');
    const exportCsvBtn = container.querySelector('#exportCsv');
    const exportJsonBtn = container.querySelector('#exportJson');

    let filtered = rows.slice();
    window.currentBatchRows = filtered; // Store for modal access
    window.currentBatchAlgorithm = (data.algorithm || '').toUpperCase();

    function colorForScore(pct) {
        if (pct >= 80) return '#10b981';
        if (pct >= 60) return '#f59e0b';
        return '#ef4444';
    }

    function renderTable() {
        tbody.innerHTML = '';
        window.currentBatchRows = filtered; // Update stored rows
        filtered.forEach((row, idx) => {
            const rank = idx + 1;
            const color = colorForScore(row.relevance_pct);
            const matched = row.matched_keywords.join(', ') || '-';
            const missing = row.missing_keywords.join(', ') || '-';
            const encodedName = encodeURIComponent(row.cv_name);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rank}</td>
                <td><strong><a href="/cvs/${encodedName}" target="_blank" style="color: var(--primary-color); text-decoration: none;">${row.cv_name}</a></strong></td>
                <td>${row.job_name}</td>
                <td>${matched}</td>
                <td>${missing}</td>
                <td><span style="font-weight:700; color:${color}">${row.relevance_pct}%</span></td>
                <td>${(data.algorithm || '').toUpperCase()}</td>
                <td>-</td>
                <td>-</td>
                <td><button class="analyze-btn" style="width:auto; padding:8px 12px;" onclick="showCandidateDetails(${idx})">🔍 View</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function refilter() {
        const q = (searchInput.value || '').toLowerCase();
        if (!q) {
            filtered = rows.slice();
        } else {
            filtered = rows.filter(r =>
                r.cv_name.toLowerCase().includes(q) ||
                r.job_name.toLowerCase().includes(q) ||
                r.matched_keywords.join(' ').toLowerCase().includes(q) ||
                r.missing_keywords.join(' ').toLowerCase().includes(q)
            );
        }
        // keep sorted by score desc
        filtered.sort((a, b) => b.relevance_pct - a.relevance_pct);
        renderTable();
    }

    searchInput.addEventListener('input', refilter);

    exportCsvBtn.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rows: filtered.map(r => ({
                        candidate: r.cv_name,
                        job: r.job_name,
                        relevance_pct: r.relevance_pct,
                        matched_keywords: r.matched_keywords.join(', '),
                        missing_keywords: r.missing_keywords.join(', '),
                        algorithm: (data.algorithm || '').toUpperCase()
                    })),
                    format: 'csv',
                    filename: 'results_batch'
                })
            });
            if (resp.ok) {
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'results_batch.csv'; a.click();
                URL.revokeObjectURL(url);
            }
        } catch (_) {}
    });

    exportJsonBtn.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rows: filtered,
                    format: 'json',
                    filename: 'results_batch'
                })
            });
            if (resp.ok) {
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'results_batch.json'; a.click();
                URL.revokeObjectURL(url);
            }
        } catch (_) {}
    });

    renderTable();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display batch compare results
function displayBatchCompareResults(data) {
    const container = document.getElementById('batchCompareResults');
    container.classList.add('active');
    container.innerHTML = '';
    
    // Store data globally for candidate details
    window.currentBatchCompareData = data;
    
    let html = `
        <div class="result-card">
            <h3>Batch Algorithm Comparison Results</h3>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total CVs</div>
                    <div class="metric-value">${data.total_cvs}</div>
                </div>
                <div class="metric-card success">
                    <div class="metric-label">Matched CVs</div>
                    <div class="metric-value">${data.matched_cvs || 0} / ${data.total_cvs}</div>
                </div>
                <div class="metric-card success">
                    <div class="metric-label">Processing Time</div>
                    <div class="metric-value">${data.processing_time_seconds || 0}s</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Job</div>
                    <div class="metric-value" style="font-size: 1.2rem;">${data.job_name}</div>
                </div>
            </div>
    `;
    
    if (data.errors && data.errors.length > 0) {
        html += `
            <div style="margin-top: 20px; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                <strong>Errors:</strong>
                <ul style="margin-top: 10px;">
        `;
        data.errors.forEach(err => {
            html += `<li style="margin: 5px 0; color: var(--danger-color);">${err}</li>`;
        });
        html += `</ul></div>`;
    }
    
    // Create algorithm summary
    const algoStats = {};
    ['bf', 'kmp', 'rk'].forEach(algo => {
        algoStats[algo] = {
            total_time: 0,
            total_comparisons: 0,
            avg_relevance: 0,
            cvs_tested: 0
        };
    });
    
    data.results.forEach(cv => {
        cv.algorithms.forEach(algo => {
            algoStats[algo.algorithm].total_time += algo.total_time_s;
            algoStats[algo.algorithm].total_comparisons += algo.total_comparisons;
            algoStats[algo.algorithm].avg_relevance += algo.relevance_pct;
            algoStats[algo.algorithm].cvs_tested += 1;
        });
    });
    
    // Calculate averages
    Object.keys(algoStats).forEach(algo => {
        if (algoStats[algo].cvs_tested > 0) {
            algoStats[algo].avg_relevance = algoStats[algo].avg_relevance / algoStats[algo].cvs_tested;
        }
    });
    
    html += `
        <h4 style="margin-top: 30px;">Algorithm Performance Summary</h4>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Algorithm</th>
                    <th>Avg Relevance (%)</th>
                    <th>Total Time (s)</th>
                    <th>Total Comparisons</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    Object.keys(algoStats).forEach(algo => {
        const stats = algoStats[algo];
        html += `
            <tr>
                <td><strong>${algo.toUpperCase()}</strong></td>
                <td>${stats.avg_relevance.toFixed(2)}%</td>
                <td>${stats.total_time.toFixed(6)}</td>
                <td>${stats.total_comparisons.toLocaleString()}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        
        <h4 style="margin-top: 30px;">Candidates by Job</h4>
    `;
    
    // Group by job position
    const jobGroups = {};
    data.results.forEach(cv => {
        const jobName = cv.job_name || data.job_name;
        if (!jobGroups[jobName]) {
            jobGroups[jobName] = [];
        }
        jobGroups[jobName].push(cv);
    });
    
    // Sort candidates within each job by best relevance
    Object.keys(jobGroups).forEach(job => {
        jobGroups[job].sort((a, b) => {
            const maxA = Math.max(...a.algorithms.map(x => x.relevance_pct || 0));
            const maxB = Math.max(...b.algorithms.map(x => x.relevance_pct || 0));
            return maxB - maxA;
        });
    });
    
    // Display candidates grouped by job
    Object.keys(jobGroups).forEach(jobName => {
        const candidates = jobGroups[jobName];
        html += `
            <div style="margin-top: 25px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--primary-color);">
                <h3 style="margin-bottom: 15px; color: var(--primary-color);">
                    ${jobName}
                    <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: normal;">(${candidates.length} candidate${candidates.length !== 1 ? 's' : ''})</span>
                </h3>
        `;
        
        candidates.forEach((cv, idx) => {
            const encodedName = encodeURIComponent(cv.cv_name);
            const best = cv.algorithms.reduce((best, curr) => (curr.relevance_pct > best.relevance_pct ? curr : best), cv.algorithms[0]);
            const bestColor = best.relevance_pct >= 70 ? '#10b981' : best.relevance_pct >= 40 ? '#f59e0b' : '#ef4444';
            const escapedCvName = cv.cv_name.replace(/'/g, "\\'");
            
            html += `
                <div style="margin-bottom: 15px; padding: 15px; background: var(--bg-color); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: 700; color: var(--text-secondary);">${idx + 1}.</span>
                            <a href="/cvs/${encodedName}" target="_blank" 
                               style="color: var(--primary-color); text-decoration: none; font-weight: 600;"
                               onmouseover="this.style.textDecoration='underline'; this.style.color='var(--secondary-color)'" 
                               onmouseout="this.style.textDecoration='none'; this.style.color='var(--primary-color)'">
                               ${cv.cv_name}
                           </a>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-weight: 700; color: ${bestColor}; font-size: 1.1rem;">${best.relevance_pct}%</span>
                        <button class="analyze-btn" style="width:auto; padding:8px 16px;" 
                                onclick="showBatchCompareCandidateDetails('${escapedCvName}', '${best.algorithm}')">
                            🔍 View Details
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    html += `
        <h4 style="margin-top: 30px;">Individual CV Results (sorted by best score)</h4>
    `;
    
    // Sort CVs by their best algorithm relevance desc
    const sortedCVs = data.results.slice().sort((a, b) => {
        const maxA = Math.max(...a.algorithms.map(x => x.relevance_pct || 0));
        const maxB = Math.max(...b.algorithms.map(x => x.relevance_pct || 0));
        if (maxB !== maxA) return maxB - maxA;
        // tiebreaker: fastest total_time_s among best relevance
        const minTimeA = Math.min(...a.algorithms.map(x => x.total_time_s || 0));
        const minTimeB = Math.min(...b.algorithms.map(x => x.total_time_s || 0));
        return minTimeA - minTimeB;
    });
    
    const topCVs = sortedCVs.slice(0, 20);
    
    topCVs.forEach((cv, idx) => {
        const encodedName = encodeURIComponent(cv.cv_name);
        const best = cv.algorithms.reduce((best, curr) => (curr.relevance_pct > best.relevance_pct ? curr : best), cv.algorithms[0]);
        const escapedCvName = cv.cv_name.replace(/'/g, "\\'");
        html += `
            <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-color); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h5 style="margin: 0;">
                        ${idx + 1}. <a href="/cvs/${encodedName}" target="_blank" 
                           style="color: var(--primary-color); text-decoration: none; cursor: pointer;"
                           onmouseover="this.style.textDecoration='underline'; this.style.color='var(--secondary-color)'" 
                           onmouseout="this.style.textDecoration='none'; this.style.color='var(--primary-color)'}">
                           📄 ${cv.cv_name} — Best (${best.relevance_pct}%)
                       </a>
                    </h5>
                    <button class="analyze-btn" style="width:auto; padding:8px 16px;" 
                            onclick="showBatchCompareCandidateDetails('${escapedCvName}', '${best.algorithm}')">
                        🔍 View Details
                    </button>
                </div>
                <table class="comparison-table" style="font-size: 0.9rem;">
                    <thead>
                        <tr>
                            <th>Algorithm</th>
                            <th>Relevance (%)</th>
                            <th>Time (s)</th>
                            <th>Comparisons</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        cv.algorithms.forEach(algo => {
            const color = algo.relevance_pct >= 70 ? '#10b981' : algo.relevance_pct >= 40 ? '#f59e0b' : '#ef4444';
            html += `
                <tr>
                    <td><strong>${algo.algorithm.toUpperCase()}</strong></td>
                    <td><span style="color: ${color}">${algo.relevance_pct}%</span></td>
                    <td>${algo.total_time_s}</td>
                    <td>${algo.total_comparisons.toLocaleString()}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    });
    
    if (sortedCVs.length > 20) {
        html += `<p style="text-align: center; color: var(--text-secondary);">... and ${sortedCVs.length - 20} more CVs</p>`;
    }
    
    html += '</div>';
    
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Add job templates to Batch Analyze tab
function applyJobTemplate(template) {
    const templates = {
        'data_scientist': {
            mandatory: ['Python','Machine Learning','SQL','Data Analysis','Pandas','NumPy'],
            optional: ['TensorFlow','PyTorch','Scikit-learn','Matplotlib','Seaborn','Docker','AWS']
        },
        'web_developer': {
            mandatory: ['HTML','CSS','JavaScript','React','Node.js','Git'],
            optional: ['TypeScript','Redux','Next.js','Express','MongoDB','REST API']
        },
        'software_engineer': {
            mandatory: ['OOP','Data Structures','Algorithms','Git','Unit Testing','Java or C++ or Python'],
            optional: ['SQL','Design Patterns','Docker','CI/CD']
        }
    };
    const sel = templates[template];
    if (!sel) return;
    const m = document.getElementById('batchMandatoryKeywords');
    const o = document.getElementById('batchOptionalKeywords');
    if (m) m.value = sel.mandatory.join('\n');
    if (o) o.value = sel.optional.join('\n');
}

function showCandidateDetails(idx) {
    const rows = window.currentBatchRows || [];
    if (!rows || idx >= rows.length) {
        alert('Candidate data not available');
        return;
    }
    const row = rows[idx];
    const color = row.relevance_pct >= 80 ? '#10b981' : row.relevance_pct >= 60 ? '#f59e0b' : '#ef4444';
    
    const modalHtml = `
        <div id="candidateModal" class="modal-overlay" onclick="if(event.target.id==='candidateModal') closeCandidateModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Candidate Details</h2>
                    <button class="modal-close" onclick="closeCandidateModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="candidate-header">
                        <h3>${row.cv_name}</h3>
                        <div class="score-badge" style="background:${color}; padding:8px 16px; border-radius:8px; font-size:1.2rem; font-weight:700; color:white;">
                            ${row.relevance_pct}%
                        </div>
                    </div>
                    <div style="margin:20px 0;">
                        <p><strong>Job Position:</strong> ${row.job_name}</p>
                        <p><strong>Algorithm Used:</strong> ${window.currentBatchAlgorithm || 'N/A'}</p>
                    </div>
                    <div class="keywords-breakdown">
                        <h4>Mandatory Skills</h4>
                        <p><strong>Matched:</strong> ${row.matched_mandatory_count || 0} / ${row.mandatory_count || 0}</p>
                        <div style="margin:8px 0;">
                            ${(row.matched_mandatory || []).length > 0 ? 
                                row.matched_mandatory.map(k => 
                                    `<span class="keyword-tag mandatory found">${k}</span>`
                                ).join(' ') : '<span style="color:var(--text-secondary);">None matched</span>'}
                        </div>
                        ${(row.missing_mandatory || []).length > 0 ? `
                            <div style="margin-top:8px;">
                                <strong>Missing:</strong>
                                ${row.missing_mandatory.map(k => 
                                    `<span class="keyword-tag mandatory">${k}</span>`
                                ).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="keywords-breakdown" style="margin-top:20px;">
                        <h4>Optional Skills</h4>
                        <p><strong>Matched:</strong> ${row.matched_optional_count || 0} / ${row.optional_count || 0}</p>
                        <div style="margin:8px 0;">
                            ${(row.matched_optional || []).length > 0 ? 
                                row.matched_optional.map(k => 
                                    `<span class="keyword-tag optional found">${k}</span>`
                                ).join(' ') : '<span style="color:var(--text-secondary);">None matched</span>'}
                        </div>
                        ${(row.missing_optional || []).length > 0 ? `
                            <div style="margin-top:8px;">
                                <strong>Missing:</strong>
                                ${row.missing_optional.map(k => 
                                    `<span class="keyword-tag optional">${k}</span>`
                                ).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
}

function closeCandidateModal() {
    const modal = document.getElementById('candidateModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// Show candidate details from batch compare
function showBatchCompareCandidateDetails(cvName, algorithm) {
    const data = window.currentBatchCompareData;
    if (!data || !data.results) {
        alert('Candidate data not available');
        return;
    }
    
    // Find the candidate
    const cv = data.results.find(r => r.cv_name === cvName);
    if (!cv) {
        alert('Candidate not found');
        return;
    }
    
    // Find the algorithm result
    const algoResult = cv.algorithms.find(a => a.algorithm === algorithm);
    if (!algoResult) {
        alert('Algorithm result not found');
        return;
    }
    
    const color = algoResult.relevance_pct >= 80 ? '#10b981' : algoResult.relevance_pct >= 60 ? '#f59e0b' : '#ef4444';
    
    const modalHtml = `
        <div id="candidateModal" class="modal-overlay" onclick="if(event.target.id==='candidateModal') closeCandidateModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Candidate Details</h2>
                    <button class="modal-close" onclick="closeCandidateModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="candidate-header">
                        <h3>${cv.cv_name}</h3>
                        <div class="score-badge" style="background:${color}; padding:8px 16px; border-radius:8px; font-size:1.2rem; font-weight:700; color:white;">
                            ${algoResult.relevance_pct}%
                        </div>
                    </div>
                    <div style="margin:20px 0;">
                        <p><strong>Job Position:</strong> ${cv.job_name || data.job_name}</p>
                        <p><strong>Algorithm Used:</strong> ${algoResult.algorithm.toUpperCase()}</p>
                    </div>
                    <div class="keywords-breakdown">
                        <h4>Mandatory Skills</h4>
                        <p><strong>Matched:</strong> ${algoResult.matched_mandatory_count || 0} / ${algoResult.mandatory_count || 0}</p>
                        <div style="margin:8px 0;">
                            ${(algoResult.matched_mandatory || []).length > 0 ? 
                                algoResult.matched_mandatory.map(k => 
                                    `<span class="keyword-tag mandatory found">${k}</span>`
                                ).join(' ') : '<span style="color:var(--text-secondary);">None matched</span>'}
                        </div>
                        ${(algoResult.missing_mandatory || []).length > 0 ? `
                            <div style="margin-top:8px;">
                                <strong>Missing:</strong>
                                ${algoResult.missing_mandatory.map(k => 
                                    `<span class="keyword-tag mandatory">${k}</span>`
                                ).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="keywords-breakdown" style="margin-top:20px;">
                        <h4>Optional Skills</h4>
                        <p><strong>Matched:</strong> ${algoResult.matched_optional_count || 0} / ${algoResult.optional_count || 0}</p>
                        <div style="margin:8px 0;">
                            ${(algoResult.matched_optional || []).length > 0 ? 
                                algoResult.matched_optional.map(k => 
                                    `<span class="keyword-tag optional found">${k}</span>`
                                ).join(' ') : '<span style="color:var(--text-secondary);">None matched</span>'}
                        </div>
                        ${(algoResult.missing_optional || []).length > 0 ? `
                            <div style="margin-top:8px;">
                                <strong>Missing:</strong>
                                ${algoResult.missing_optional.map(k => 
                                    `<span class="keyword-tag optional">${k}</span>`
                                ).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('CV Analyzer loaded successfully');
    loadJobs();
    updateFormUI(); // Initialize form UI state
});

let editingJobTitle = null; // Track if we're editing an existing job

async function createJob() {
    const titleInput = document.getElementById('newJobTitle');
    const title = titleInput.value.trim();
    const mandatory = document.getElementById('newMandatoryKeywords').value.split('\n').filter(k => k.trim());
    const optional = document.getElementById('newOptionalKeywords').value.split('\n').filter(k => k.trim());
    
    if (!title) {
        showError('Please enter a job title.');
        return;
    }
    if (mandatory.length === 0 && optional.length === 0) {
        showError('Please enter at least one keyword (mandatory or optional).');
        return;
    }
    
    try {
        const resp = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, mandatory, optional })
        });
        const data = await resp.json();
        if (data.error) {
            showError(data.error);
        } else {
            // Clear form and reset edit mode
            const wasEditing = editingJobTitle !== null;
            titleInput.value = '';
            document.getElementById('newMandatoryKeywords').value = '';
            document.getElementById('newOptionalKeywords').value = '';
            editingJobTitle = null;
            updateFormUI();
            // Reload jobs and refresh selectors
            await loadJobs();
            alert(wasEditing ? 'Job description updated successfully!' : 'Job description created successfully!');
        }
    } catch (e) {
        showError('An error occurred: ' + e.message);
    }
}

function editJob(title) {
    console.log('editJob called with title:', title);
    console.log('Available jobs:', Object.keys(JOBS));
    
    // Load the job data
    const job = JOBS[title];
    if (!job) {
        console.error('Job not found in JOBS object:', title);
        showError('Job not found.');
        return;
    }
    
    // Populate the form
    document.getElementById('newJobTitle').value = title;
    document.getElementById('newMandatoryKeywords').value = (job.mandatory || []).join('\n');
    document.getElementById('newOptionalKeywords').value = (job.optional || []).join('\n');
    
    // Set edit mode
    editingJobTitle = title;
    updateFormUI();
    
    // Scroll to form
    document.getElementById('newJobTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteJob(title) {
    if (!confirm(`Are you sure you want to delete the job "${title}"?`)) {
        return;
    }
    
    try {
        // Encode the title for URL (handle special characters)
        const encodedTitle = encodeURIComponent(title);
        const resp = await fetch(`/api/jobs/${encodedTitle}`, {
            method: 'DELETE'
        });
        const data = await resp.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            // Clear form if editing the deleted job
            if (editingJobTitle === title) {
                document.getElementById('newJobTitle').value = '';
                document.getElementById('newMandatoryKeywords').value = '';
                document.getElementById('newOptionalKeywords').value = '';
                editingJobTitle = null;
                updateFormUI();
            }
            
            await loadJobs();
            listJobs();
            alert('Job deleted successfully!');
        }
    } catch (e) {
        showError('An error occurred: ' + e.message);
    }
}

function cancelEdit() {
    editingJobTitle = null;
    document.getElementById('newJobTitle').value = '';
    document.getElementById('newMandatoryKeywords').value = '';
    document.getElementById('newOptionalKeywords').value = '';
    updateFormUI();
}

function updateFormUI() {
    const formSection = document.querySelector('#jobs-tab .form-section');
    const titleInput = document.getElementById('newJobTitle');
    const submitBtn = document.querySelector('#jobs-tab button.analyze-btn');
    
    if (editingJobTitle) {
        // Update heading
        const heading = formSection.querySelector('h2');
        if (heading) heading.textContent = 'Edit Job Description';
        
        // Update button text
        if (submitBtn) submitBtn.textContent = 'Update Job Description';
        
        // Add cancel button if not exists
        if (!document.getElementById('cancelEditBtn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.className = 'analyze-btn';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = cancelEdit;
            cancelBtn.style.cssText = 'margin-top:20px; margin-left:10px; background:var(--text-secondary);';
            submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
        }
        
        // Disable title input (can't change title when editing)
        titleInput.disabled = true;
        titleInput.style.opacity = '0.6';
    } else {
        // Update heading
        const heading = formSection.querySelector('h2');
        if (heading) heading.textContent = 'Create New Job Description';
        
        // Update button text
        if (submitBtn) submitBtn.textContent = 'Create Job Description';
        
        // Remove cancel button
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.remove();
        
        // Enable title input
        titleInput.disabled = false;
        titleInput.style.opacity = '1';
    }
}

async function listJobs() {
    const container = document.getElementById('jobsList');
    container.classList.add('active');
    container.innerHTML = '<div class="result-card"><h3>Loading...</h3></div>';
    try {
        const resp = await fetch('/api/jobs');
        const data = await resp.json();
        if (data.error) {
            container.innerHTML = `<div class="error-message">${data.error}</div>`;
            return;
        }
        const jobs = data.jobs || {};
        if (Object.keys(jobs).length === 0) {
            container.innerHTML = '<div class="result-card"><h3>No job descriptions found</h3><p>Create your first job description above.</p></div>';
            return;
        }
        let html = '<div class="result-card"><h3>Existing Job Descriptions</h3>';
        // Create a wrapper div for each job
        const jobsContainer = document.createElement('div');
        
        Object.keys(jobs).forEach(title => {
            const j = jobs[title];
            const mandCount = (j.mandatory || []).length;
            const optCount = (j.optional || []).length;
            // Escape title for HTML display
            const htmlTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            
            // Create job card element
            const jobDiv = document.createElement('div');
            jobDiv.style.cssText = 'padding:15px; margin:10px 0; background:var(--bg-color); border-radius:12px; border-left:4px solid var(--blue);';
            
            // Create header with buttons
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;';
            
            const titleH4 = document.createElement('h4');
            titleH4.style.margin = '0';
            titleH4.textContent = title;
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.cssText = 'display:flex; gap:8px;';
            
            // Create Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'analyze-btn job-edit-btn';
            editBtn.textContent = 'Edit';
            editBtn.style.cssText = 'width:auto; padding:6px 12px; font-size:0.9rem;';
            editBtn.dataset.jobTitle = title; // Use dataset API
            editBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const jobTitle = this.dataset.jobTitle;
                console.log('Edit clicked for job:', jobTitle);
                if (jobTitle) {
                    editJob(jobTitle);
                }
            });
            
            // Create Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'analyze-btn job-delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.cssText = 'width:auto; padding:6px 12px; font-size:0.9rem; background:var(--danger-color);';
            deleteBtn.dataset.jobTitle = title; // Use dataset API
            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const jobTitle = this.dataset.jobTitle;
                console.log('Delete clicked for job:', jobTitle);
                if (jobTitle) {
                    deleteJob(jobTitle);
                }
            });
            
            buttonsDiv.appendChild(editBtn);
            buttonsDiv.appendChild(deleteBtn);
            
            headerDiv.appendChild(titleH4);
            headerDiv.appendChild(buttonsDiv);
            
            // Create content
            const mandP = document.createElement('p');
            mandP.style.cssText = 'color:var(--text-secondary); margin-bottom:6px;';
            mandP.innerHTML = `<strong>Mandatory:</strong> ${mandCount} keywords`;
            
            const optP = document.createElement('p');
            optP.style.cssText = 'color:var(--text-secondary); margin-bottom:6px;';
            optP.innerHTML = `<strong>Optional:</strong> ${optCount} keywords`;
            
            const keywordsDiv = document.createElement('div');
            keywordsDiv.style.marginTop = '8px';
            const mandatoryTags = (j.mandatory || []).slice(0,5).map(k => `<span class="keyword-tag mandatory">${k}</span>`).join(' ');
            const optionalTags = (j.optional || []).slice(0,5).map(k => `<span class="keyword-tag optional">${k}</span>`).join(' ');
            const moreIndicator = (mandCount + optCount > 10 ? '<span style="color:var(--text-secondary);">...</span>' : '');
            keywordsDiv.innerHTML = mandatoryTags + ' ' + optionalTags + ' ' + moreIndicator;
            
            jobDiv.appendChild(headerDiv);
            jobDiv.appendChild(mandP);
            jobDiv.appendChild(optP);
            jobDiv.appendChild(keywordsDiv);
            
            jobsContainer.appendChild(jobDiv);
        });
        
        // Append to result card
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        resultCard.innerHTML = '<h3>Existing Job Descriptions</h3>';
        resultCard.appendChild(jobsContainer);
        container.innerHTML = '';
        container.appendChild(resultCard);
    } catch (e) {
        container.innerHTML = `<div class="error-message">${e.message}</div>`;
    }
}

