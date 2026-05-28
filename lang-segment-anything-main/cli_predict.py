import argparse
import json
from pathlib import Path

def build_parser():
    parser = argparse.ArgumentParser(description="Run LangSAM from the terminal without Gradio.")
    parser.add_argument("--image", default="./assets/car.jpeg", help="Input image path.")
    parser.add_argument("--prompt", default="wheel.", help="Text prompt, for example: person. or wheel.")
    parser.add_argument("--output-dir", default="./outputs/cli_predict", help="Directory used to save output files.")
    parser.add_argument("--sam-type", default="sam2.1_hiera_small", help="SAM model type.")
    parser.add_argument("--box-threshold", type=float, default=0.3, help="Grounding box threshold.")
    parser.add_argument("--text-threshold", type=float, default=0.25, help="Grounding text threshold.")
    return parser


def save_outputs(image_path: Path, prompt: str, output_dir: Path, result: dict, image_pil, draw_image, np, image_cls):
    output_dir.mkdir(parents=True, exist_ok=True)

    result_image_path = output_dir / "result.png"
    mask_path = output_dir / "mask.png"
    metadata_path = output_dir / "result.json"

    metadata = {
        "image_path": str(image_path),
        "text_prompt": prompt,
        "status": "success" if len(result["masks"]) else "no_target",
        "mask": None,
        "result_image": str(result_image_path),
        "boxes": result["boxes"].tolist() if len(result["boxes"]) else [],
        "scores": result["scores"].tolist() if len(result["scores"]) else [],
        "labels": list(result["labels"]) if result["labels"] else [],
        "mask_scores": result["mask_scores"].tolist() if len(result["mask_scores"]) else [],
    }

    if len(result["masks"]):
        merged_mask = (np.any(result["masks"], axis=0).astype(np.uint8) * 255)
        image_cls.fromarray(merged_mask).save(mask_path)
        metadata["mask"] = str(mask_path)

        output_image = draw_image(
            np.asarray(image_pil),
            result["masks"],
            result["boxes"],
            result["scores"],
            result["labels"],
        )
        image_cls.fromarray(np.uint8(output_image)).convert("RGB").save(result_image_path)
    else:
        image_pil.save(result_image_path)

    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata, metadata_path


def main():
    parser = build_parser()
    args = parser.parse_args()

    image_path = Path(args.image).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    print("LangSAM CLI started.")
    print(f"image: {image_path}")
    print(f"prompt: {args.prompt}")
    print(f"output_dir: {output_dir}")
    print(f"sam_type: {args.sam_type}")
    print(f"box_threshold: {args.box_threshold}")
    print(f"text_threshold: {args.text_threshold}")
    print("Loading LangSAM dependencies...")

    import numpy as np
    from PIL import Image

    from lang_sam import LangSAM
    from lang_sam.utils import draw_image

    print("Initializing model...")
    model = LangSAM(sam_type=args.sam_type)
    image_pil = Image.open(image_path).convert("RGB")
    print("Running prediction...")
    results = model.predict(
        images_pil=[image_pil],
        texts_prompt=[args.prompt],
        box_threshold=args.box_threshold,
        text_threshold=args.text_threshold,
    )
    result = results[0]

    print("Saving outputs...")
    metadata, metadata_path = save_outputs(image_path, args.prompt, output_dir, result, image_pil, draw_image, np, Image)

    print("LangSAM prediction finished.")
    print(f"status: {metadata['status']}")
    print(f"result_image: {metadata['result_image']}")
    print(f"mask: {metadata['mask']}")
    print(f"metadata: {metadata_path}")


if __name__ == "__main__":
    main()
