"""
Model registry.

Every model to be benchmarked is declared here, once, along with whether
it needs scaled input (see scaling.py) and any special handling it needs
(e.g. SVR is subsampled — see the note below). To add a new model, add
one entry to the dict in get_model_registry(); nothing else in the
pipeline needs to change.

Models included:
    - linear_regression   (sklearn)
    - random_forest       (sklearn)
    - gradient_boosting   (sklearn)
    - xgboost              [optional — only added if the package is installed]
    - lightgbm             [optional — only added if the package is installed]
    - catboost             [optional — only added if the package is installed]
    - svr                  (sklearn)
    - mlp                  (sklearn MLPRegressor — a small, fast neural net)
    - keras_nn             [optional — a deeper neural net, only added if
                             tensorflow is installed]

NOTE ON SVR AND SCALE
----------------------
SVR has training cost that grows roughly quadratically-to-cubically with
the number of rows. On ~2.8M training rows (2005-2016 x 24 governorates)
this is not tractable on a single machine. train.py subsamples SVR's
training data to `max_train_rows` for this reason. This is a practical
necessity, not a modeling choice — if you have access to a cluster or
want a full-scale linear-time alternative, LinearSVR or SGDRegressor
scale to the full dataset and are drop-in replacements here.

NOTE ON THE TWO NEURAL NETWORKS
---------------------------------
`mlp` (sklearn) and `keras_nn` (TensorFlow/Keras) are both included
deliberately, not redundantly:
    - `mlp` is lightweight, has zero extra dependencies beyond
      scikit-learn (already required everywhere else), and trains fast —
      good as a baseline neural net and for quick iteration.
    - `keras_nn` gives you a deeper network, mini-batch GPU-capable
      training, and early stopping on a held-out split — closer to what
      you'd use if the NN turns out to be competitive and worth tuning
      further. It's optional (see requirements.txt) since TensorFlow is a
      large dependency that not everyone running this project will want.
"""

import numpy as np

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.neural_network import MLPRegressor

from src import config

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMRegressor
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

try:
    from catboost import CatBoostRegressor
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False

try:
    import tensorflow as tf
    from tensorflow import keras
    HAS_TENSORFLOW = True
except ImportError:
    HAS_TENSORFLOW = False


class KerasMLPRegressor:
    """
    Minimal wrapper around a Keras Sequential MLP, giving it the same
    fit(X, y) / predict(X) interface as every other model in this
    registry so train.py doesn't need any special-casing for it.

    WHY THE CUSTOM __getstate__/__setstate__:
    Keras models don't pickle cleanly on their own (they hold references
    to TensorFlow graph/backend internals that plain pickle can't
    serialize), which means a bare `joblib.dump(model, path)` would fail
    or silently produce something broken. Instead, the architecture is
    stored as JSON and the weights as plain numpy arrays; on load, the
    model is rebuilt from that JSON and the weights are re-applied. This
    makes `joblib.dump`/`joblib.load` work exactly like it does for every
    other model in the project.
    """

    def __init__(self, hidden_layers=(128, 64, 32), activation="relu",
                 learning_rate=1e-3, epochs=50, batch_size=1024,
                 validation_split=0.1, patience=5, random_state=42, verbose=0):
        self.hidden_layers = hidden_layers
        self.activation = activation
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.batch_size = batch_size
        self.validation_split = validation_split
        self.patience = patience
        self.random_state = random_state
        self.verbose = verbose
        self.model = None

    def _build_model(self, input_dim):
        tf.random.set_seed(self.random_state)
        model = keras.Sequential([keras.layers.Input(shape=(input_dim,))])
        for units in self.hidden_layers:
            model.add(keras.layers.Dense(units, activation=self.activation))
        model.add(keras.layers.Dense(1, activation="linear"))
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.learning_rate),
            loss="mse",
            metrics=["mae"],
        )
        return model

    def fit(self, X, y):
        X = np.asarray(X, dtype="float32")
        y = np.asarray(y, dtype="float32")
        self.model = self._build_model(X.shape[1])

        early_stop = keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=self.patience, restore_best_weights=True
        )
        self.model.fit(
            X, y,
            epochs=self.epochs,
            batch_size=self.batch_size,
            validation_split=self.validation_split,
            callbacks=[early_stop],
            verbose=self.verbose,
        )
        return self

    def predict(self, X):
        X = np.asarray(X, dtype="float32")
        return self.model.predict(X, verbose=0).ravel()

    def __getstate__(self):
        state = self.__dict__.copy()
        if self.model is not None:
            state["_architecture_json"] = self.model.to_json()
            state["_weights"] = self.model.get_weights()
        state["model"] = None
        return state

    def __setstate__(self, state):
        architecture_json = state.pop("_architecture_json", None)
        weights = state.pop("_weights", None)
        self.__dict__.update(state)
        if architecture_json is not None:
            self.model = keras.models.model_from_json(architecture_json)
            self.model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=self.learning_rate),
                loss="mse",
                metrics=["mae"],
            )
            self.model.set_weights(weights)


def get_model_registry() -> dict:
    registry = {
        "linear_regression": {
            "model": LinearRegression(),
            "needs_scaling": True,
        },
        "random_forest": {
            "model": RandomForestRegressor(
                n_estimators=150,       # was 300 — halves the saved model size
                max_depth=16,           # was 20 — capping depth shrinks tree size further
                min_samples_leaf=3,     # stops trees memorizing individual rows, also shrinks size
                random_state=config.RANDOM_STATE,
                n_jobs=-1,
            ),
            "needs_scaling": False,
        },
        "gradient_boosting": {
            "model": GradientBoostingRegressor(
                n_estimators=300,
                max_depth=5,
                learning_rate=0.05,
                random_state=config.RANDOM_STATE,
            ),
            "needs_scaling": False,
            # GradientBoostingRegressor (sklearn) is single-threaded and slow on
            # very large datasets; subsample it too unless you have time to spare.
            "max_train_rows": 500_000,
        },
        "svr": {
            "model": SVR(kernel="rbf", C=10, epsilon=0.1),
            "needs_scaling": True,
            "max_train_rows": 50_000,  # SVR is O(n^2)-O(n^3): required for tractable training time
        },
        "mlp": {
            "model": MLPRegressor(
                hidden_layer_sizes=(128, 64),
                activation="relu",
                solver="adam",
                alpha=1e-4,
                batch_size=1024,
                max_iter=100,
                early_stopping=True,
                n_iter_no_change=5,
                random_state=config.RANDOM_STATE,
            ),
            "needs_scaling": True,
        },
    }

    if HAS_XGBOOST:
        registry["xgboost"] = {
            "model": XGBRegressor(
                n_estimators=500,
                max_depth=8,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=config.RANDOM_STATE,
                n_jobs=-1,
                tree_method="hist",
            ),
            "needs_scaling": False,
        }

    if HAS_LIGHTGBM:
        registry["lightgbm"] = {
            "model": LGBMRegressor(
                n_estimators=500,
                max_depth=-1,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=config.RANDOM_STATE,
                n_jobs=-1,
            ),
            "needs_scaling": False,
        }

    if HAS_CATBOOST:
        registry["catboost"] = {
            "model": CatBoostRegressor(
                iterations=500,
                depth=8,
                learning_rate=0.05,
                random_state=config.RANDOM_STATE,
                verbose=False,
            ),
            "needs_scaling": False,
        }

    if HAS_TENSORFLOW:
        registry["keras_nn"] = {
            "model": KerasMLPRegressor(
                hidden_layers=(128, 64, 32),
                epochs=50,
                batch_size=1024,
                random_state=config.RANDOM_STATE,
            ),
            "needs_scaling": True,
        }

    return registry
