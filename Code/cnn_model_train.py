"""Train the SAHAYAK CNN classifier.

Run from the Code directory after load_images.py:
    python cnn_model_train.py
"""
from pathlib import Path
import pickle
import json
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

IMAGE_SIZE = (50, 50)
BATCH_SIZE = 32
EPOCHS = 20
MODEL_PATH = Path("cnn_model_keras2.keras")

def load_pickle(name):
    path = Path(name)
    if not path.exists():
        raise SystemExit(f"Missing {path}. First run: python load_images.py")
    with path.open("rb") as f:
        return pickle.load(f)

def build_model(num_classes):
    model = keras.Sequential([
        keras.Input(shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 1)),
        layers.Rescaling(1.0 / 255.0),
        layers.Conv2D(16, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D(),
        layers.Conv2D(32, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D(),
        layers.Conv2D(64, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D(),
        layers.Flatten(),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(optimizer="adam",
                  loss="sparse_categorical_crossentropy",
                  metrics=["accuracy"])
    return model

def main():
    X_train = np.asarray(load_pickle("train_images"), dtype=np.float32)[..., None]
    y_train = np.asarray(load_pickle("train_labels"), dtype=np.int32)
    X_val = np.asarray(load_pickle("val_images"), dtype=np.float32)[..., None]
    y_val = np.asarray(load_pickle("val_labels"), dtype=np.int32)
    X_test = np.asarray(load_pickle("test_images"), dtype=np.float32)[..., None]
    y_test = np.asarray(load_pickle("test_labels"), dtype=np.int32)

    class_ids = sorted(set(y_train.tolist()) | set(y_val.tolist()) | set(y_test.tolist()))
    if len(class_ids) < 2:
        raise SystemExit("Need at least two gesture classes to train.")
    id_to_index = {class_id: index for index, class_id in enumerate(class_ids)}
    y_train = np.asarray([id_to_index[int(v)] for v in y_train], dtype=np.int32)
    y_val = np.asarray([id_to_index[int(v)] for v in y_val], dtype=np.int32)
    y_test = np.asarray([id_to_index[int(v)] for v in y_test], dtype=np.int32)
    num_classes = len(class_ids)
    print(f"Training with {len(X_train)} images, validating on {len(X_val)}, "
          f"testing on {len(X_test)} across {num_classes} classes.")
    model = build_model(num_classes)
    model.summary()
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            str(MODEL_PATH), monitor="val_accuracy", mode="max",
            save_best_only=True, verbose=1),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=5, restore_best_weights=True),
    ]
    model.fit(X_train, y_train, validation_data=(X_val, y_val),
              epochs=EPOCHS, batch_size=BATCH_SIZE, callbacks=callbacks)
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test accuracy: {accuracy * 100:.2f}%")
    model.save(MODEL_PATH)
    with open("class_ids.json", "w", encoding="utf-8") as f:
        json.dump(class_ids, f, indent=2)
    print(f"Saved model to {MODEL_PATH.resolve()}")

if __name__ == "__main__":
    main()
