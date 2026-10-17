# Credit Risk Prediction

A machine learning project that predicts the likelihood of loan default based on an applicant's financial and loan details.

**Live Demo:** https://credit-risk-scoring-1j2f.onrender.com/

## What it does

- Estimates the probability of loan default.
- Uses a trained classification model and a selected prediction threshold to classify risk.
- Provides a simple web interface for entering loan details.
- Exposes predictions through a FastAPI endpoint.

## Built with

Python, Pandas, NumPy, Scikit-learn, XGBoost, FastAPI, HTML, CSS and JavaScript.

## Project files

- `model_training.ipynb` — data preparation, model training and evaluation.
- `credit_risk_model.pkl` — saved trained model.
- `best_threshold.pkl` — threshold used for predictions.
- `main.py` — FastAPI application.
- `static/` — frontend files.
- `credit_risk_dataset.csv` — dataset used for training.
- `render.yaml` — Render deployment configuration.

## Run it locally

Clone this repository and open the project folder in your terminal.

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the application:

```bash
uvicorn main:app --reload
```
## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Opens the dashboard |
| `GET` | `/health` | Checks application status |
| `POST` | `/predict` | Returns a loan default prediction |

## Note

This project was developed for learning and demonstration. Its predictions should not be treated as a standalone basis for lending decisions.
