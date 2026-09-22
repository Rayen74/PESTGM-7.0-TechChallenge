"""
Final test-set evaluation.

Touch the test set exactly once, here, after a model has already been
selected from the validation comparison produced by train.py. This keeps
the reported test metrics honest — every hyperparameter/model choice was
made using only train+val data.

Run from the project root with:
    python -m src.evaluate_on_test --model random_forest
"""

import argparse
import gc

import joblib

from src import config
from src.data_loader import load_raw_data
from src.feature_engineering import build_features, get_feature_columns
from src.split import chronological_split, make_xy
from src.scaling import load_feature_scaler, apply_scaler
from src.models import get_model_registry
from src.evaluate import evaluate


def main(model_name: str, nrows: int = None):
    registry = get_model_registry()
    if model_name not in registry:
        raise ValueError(f"Unknown model '{model_name}'. Choices: {list(registry.keys())}")

    needs_scaling = registry[model_name]["needs_scaling"]

    print("Loading raw data...")
    df = load_raw_data(nrows=nrows)

    print("Engineering features...")
    df = build_features(df)
    feature_cols = get_feature_columns(df)

    print("Splitting chronologically (test set only used below)...")
    _, _, test_df = chronological_split(df)
    X_test, y_test = make_xy(test_df, feature_cols)

    # Free the full dataset and the discarded train/val slices before loading
    # the model — on a memory-constrained machine, holding the whole raw
    # dataframe in RAM at the same moment a large model is being unpickled
    # is exactly what causes an avoidable MemoryError.
    del df, test_df
    gc.collect()

    if needs_scaling:
        scaler = load_feature_scaler()
        X_test = apply_scaler(scaler, X_test)

    model_path = config.MODELS_DIR / f"{model_name}.joblib"
    print(f"Loading trained model from {model_path}...")
    model = joblib.load(model_path)

    y_pred = model.predict(X_test)
    evaluate(y_test, y_pred, set_name=f"{model_name} - FINAL TEST")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the final, one-time test evaluation.")
    parser.add_argument("--model", default="random_forest", help="Model name (default: random_forest)")
    parser.add_argument("--nrows", type=int, default=None, help="Optional row cap for a quick check")
    args = parser.parse_args()

    main(args.model, nrows=args.nrows)
