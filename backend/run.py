"""Run the API with: python run.py  (same as `uvicorn app.main:app --reload`)."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
