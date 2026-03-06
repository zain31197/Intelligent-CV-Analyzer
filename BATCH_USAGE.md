# Batch CV Analysis - Usage Guide

## What's New

Your CV analyzer now supports **batch processing** - automatically analyze all CVs in your `cvs_folder` directory without uploading files individually!

## Features

### 1. **Batch Analyze Tab**
- Analyze all CVs in `cvs_folder` using one algorithm
- See relevance scores for all CVs sorted by best match
- Perfect for screening large numbers of CVs

### 2. **Batch Compare Tab**  
- Compare all three algorithms (BF, KMP, RK) on all CVs
- Get performance metrics across your entire database
- Identifies the best algorithm for your use case

## How to Use

### Batch Analyze (Single Algorithm)

1. Click **"Batch Analyze"** tab
2. Enter your job keywords:
   - **Mandatory keywords**: Required skills (one per line)
   - **Optional keywords**: Nice-to-have skills (one per line)
3. Select an algorithm (BF, KMP, or RK)
4. Choose case sensitivity
5. Click **"Analyze All CVs in Folder"**
6. Wait for processing...
7. View results showing:
   - Total CVs found and processed
   - Sorted list by relevance %
   - Matched mandatory/optional counts for each CV

### Batch Compare (All Algorithms)

1. Click **"Batch Compare"** tab
2. Enter your job keywords
3. Select case sensitivity
4. Click **"Compare All CVs with All Algorithms"**
5. View comprehensive results:
   - Algorithm performance summary (avg relevance, total time)
   - Individual CV results for top 20 matches
   - Detailed performance metrics

## Example

### For a Data Scientist Position:

**Mandatory Keywords:**
```
Python
SQL
Machine Learning
```

**Optional Keywords:**
```
TensorFlow
PyTorch
Pandas
NumPy
```

The system will:
1. Automatically scan all CVs in `cvs_folder`
2. Search for these keywords using your chosen algorithm(s)
3. Calculate relevance scores for each CV
4. Sort by best match
5. Show detailed metrics

## Results Display

### Batch Analyze Results Include:
- **Total CVs Found**: All CVs in the folder
- **Processed**: Successfully analyzed CVs
- **Sorted Table**: CVs ranked by relevance %
- **Color Coding**: 
  - Green (≥70%): High match
  - Orange (40-69%): Medium match  
  - Red (<40%): Low match

### Batch Compare Results Include:
- **Performance Summary**: Average metrics across all CVs for each algorithm
- **Top 20 Detailed Results**: Individual CV breakdown with all three algorithms
- **Algorithm Comparison**: Which algorithm performs best overall

## Tips

1. **Start with Batch Analyze** to quickly screen all CVs
2. **Use Batch Compare** to test algorithm performance
3. **Case Insensitive** is usually better for CV screening
4. **KMP algorithm** is often fastest for long documents
5. **Check the errors section** if some CVs failed to process

## File Organization

Your current folder structure:
```
assignment2/
├── cvs_folder/          # Contains all your CVs (PDF, DOCX, DOC)
├── app.py               # Flask backend with batch endpoints
├── index.html           # Web interface with batch tabs
├── script.js            # Batch processing logic
└── ...
```

The system automatically:
- Finds all `.pdf`, `.docx`, `.doc`, and `.txt` files
- Processes them in order
- Returns comprehensive results
- Handles errors gracefully

## Performance

- **Batch processing time** depends on:
  - Number of CVs
  - CV file sizes
  - Number of keywords
  - Chosen algorithm

- **Typical speeds** (for ~100 CVs):
  - BF: ~5-10 seconds
  - KMP: ~3-8 seconds
  - RK: ~4-9 seconds

## Troubleshooting

**No CVs found?**
- Check that files are in `cvs_folder/` directory
- Ensure files are .pdf, .docx, .doc, or .txt format

**Some CVs failed?**
- Corrupted files
- Password-protected PDFs
- Format not supported

**Slow processing?**
- This is normal for large CV databases
- Use KMP for fastest results
- Reduce number of keywords to speed up

---

## Quick Start

1. Start server: `python app.py`
2. Open browser: `http://localhost:5000`
3. Click **"Batch Analyze"** tab
4. Enter keywords
5. Click **"Analyze All CVs in Folder"**
6. Review results!

Enjoy batch processing your CV database! 🎉

