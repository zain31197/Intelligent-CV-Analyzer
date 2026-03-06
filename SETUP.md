# CV Analyzer Web Application - Setup Guide

## What Was Created

This CV analyzer has been transformed from a command-line tool into a complete web application with:

### Backend (Flask)
- **app.py** - Flask REST API server with two main endpoints:
  - `/api/analyze` - Analyze CVs with a single algorithm
  - `/api/compare` - Compare all three algorithms
  - Automatic file upload handling and cleanup
  - Error handling and validation

### Frontend (HTML/CSS/JavaScript)
- **index.html** - Modern, responsive web interface
- **style.css** - Beautiful gradient UI with animations
- **script.js** - Interactive JavaScript for:
  - Drag-and-drop file uploads
  - Real-time API communication
  - Dynamic results display
  - Tab-based interface for single vs. comparison modes

### Supporting Files
- **requirements.txt** - All Python dependencies
- **jobs.json** - Example job descriptions
- **.gitignore** - Excludes temporary files
- **README.md** - Comprehensive documentation
- **start.bat** / **start.sh** - Quick start scripts

## Installation Steps

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **The uploads directory is already created**

3. **Start the application:**
   ```bash
   python app.py
   ```
   Or use: `start.bat` (Windows) or `start.sh` (Linux/Mac)

4. **Open your browser:**
   Navigate to `http://localhost:5000`

## How to Use

### Single Algorithm Mode

1. Click "Single Algorithm" tab
2. Upload a CV (PDF, DOCX, DOC, or TXT)
   - Click to browse OR drag and drop
3. Enter keywords:
   - **Mandatory:** Required skills (one per line)
   - **Optional:** Nice-to-have skills (one per line)
4. Select algorithm: BF, KMP, or RK
5. Choose case sensitivity
6. Click "Analyze CV"
7. View results with:
   - Relevance score
   - Matched keywords
   - Performance metrics table

### Compare All Algorithms

1. Click "Compare All" tab
2. Upload a CV
3. Enter mandatory and optional keywords
4. Select case sensitivity
5. Click "Compare All Algorithms"
6. View comparison table showing:
   - Performance of each algorithm
   - Fastest algorithm
   - Best matching algorithm
   - Total comparisons and time

## Features

### UI Features
- 🎨 Modern gradient design with purple/blue theme
- 📎 Drag-and-drop file upload
- 📊 Real-time metrics display
- 🔄 Loading animations
- ❌ Error handling with user-friendly messages
- 📱 Responsive design for mobile/tablet/desktop
- 🎯 Color-coded relevance scores
- 📈 Detailed performance metrics

### Algorithm Comparison
- **Brute Force (BF):** Simple O(n*m) algorithm
- **Knuth-Morris-Pratt (KMP):** Efficient O(n+m) algorithm
- **Rabin-Karp (RK):** Hash-based with collision detection

### Metrics Tracked
- Character comparisons
- Execution time (microseconds)
- Hash collisions (Rabin-Karp)
- Keyword occurrence counts
- Relevance percentage

## API Usage (for developers)

### Analyze Endpoint
```javascript
const formData = new FormData();
formData.append('cv', fileInput.files[0]);
formData.append('job_data', JSON.stringify({
  'Job Name': {
    mandatory: ['keyword1', 'keyword2'],
    optional: ['keyword3', 'keyword4']
  }
}));
formData.append('algorithm', 'kmp');
formData.append('case_sensitive', 'false');

fetch('/api/analyze', {
  method: 'POST',
  body: formData
});
```

### Compare Endpoint
```javascript
const formData = new FormData();
formData.append('cv', fileInput.files[0]);
formData.append('job_data', JSON.stringify({
  'Job Name': {
    mandatory: ['keyword1'],
    optional: ['keyword2']
  }
}));
formData.append('case_sensitive', 'false');

fetch('/api/compare', {
  method: 'POST',
  body: formData
});
```

## Troubleshooting

### Issue: "No file uploaded"
- Make sure you click to select a file or drag-and-drop

### Issue: "No text extracted"
- Try a different CV format
- Ensure the file is not password-protected

### Issue: Flask server won't start
- Check if port 5000 is available
- Install all requirements: `pip install -r requirements.txt`

### Issue: Module not found errors
- Run: `pip install -r requirements.txt`

## Technology Stack

- **Backend:** Python 3, Flask, Flask-CORS
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Algorithms:** Custom implementation (BF, KMP, Rabin-Karp)
- **File Parsing:** pdfminer, python-docx
- **Analysis:** pandas (for data handling)

## Next Steps

1. Start the server: `python app.py`
2. Open browser to `http://localhost:5000`
3. Upload a CV and test the application
4. Try both single analysis and comparison modes

Enjoy analyzing CVs! 🎉

