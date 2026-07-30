#!/usr/bin/env python3
"""Generate countries data for the quiz app.

This script processes country data from the countries workspace and generates:
1. countries.csv in utils/download_unsplash/csv/
2. countries.json in utils/download_unsplash/json/
3. countries_quiz.json in public/quizzes/
"""

import json
import os
import csv
from pathlib import Path
from datetime import datetime
import random

COUNTRIES_SOURCE = Path("/Users/maheshnatarajan/workspace/countries/public")
QUIZ_APP_ROOT = Path(__file__).parent.parent.parent
CSV_DIR = QUIZ_APP_ROOT / "utils" / "download_unsplash" / "csv"
JSON_DIR = QUIZ_APP_ROOT / "utils" / "download_unsplash" / "json"
PUBLIC_DIR = QUIZ_APP_ROOT / "public"
QUIZZES_DIR = PUBLIC_DIR / "quizzes"

CONTINENTS = ["Africa", "Antarctica", "Asia", "Australia", "Europe", "North America", "South America"]


def get_image_path(country_name, continent):
    """Find the map image for a country."""
    continent_path = COUNTRIES_SOURCE / "maps" / "countries" / continent
    if not continent_path.exists():
        return None

    # Try different filename formats
    for filename in continent_path.iterdir():
        if filename.is_file():
            base_name = filename.stem.lower()
            # Match by country name
            if base_name == country_name.lower().replace(" ", "-"):
                # Return path relative to public/
                return f"countries_images/{continent}/{filename.name}"

    return None


def load_country_data(country_file):
    """Load country JSON data."""
    try:
        with open(country_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {country_file}: {e}")
        return None


def extract_videos(country_data):
    """Extract video information from country data."""
    videos = []
    if "five_youtube_video_titles" in country_data:
        for video_item in country_data["five_youtube_video_titles"]:
            if isinstance(video_item, dict) and "video_id" in video_item:
                videos.append({
                    "source": "youtube",
                    "type": "page",
                    "pageUrl": f"https://www.youtube.com/watch?v={video_item['video_id']}",
                    "url": f"https://www.youtube.com/watch?v={video_item['video_id']}"
                })
    return videos


def generate_countries_data():
    """Generate the main countries data structure."""
    countries_data = []

    for continent in CONTINENTS:
        continent_path = COUNTRIES_SOURCE / "json" / continent
        if not continent_path.exists():
            continue

        for country_file in sorted(continent_path.glob("*.json")):
            country_json = load_country_data(country_file)
            if not country_json:
                continue

            country_name = country_json.get("country")
            if not country_name:
                continue

            image_path = get_image_path(country_name, continent)
            if not image_path:
                print(f"Warning: No image found for {country_name} ({continent})")
                continue

            videos = extract_videos(country_json)

            entry = {
                "name": country_name.lower().replace(" ", "_"),
                "display_name": f"{country_name} ({continent})",
                "continent": continent,
                "description": "",
                "images": [image_path] if image_path else [],
                "videos": videos,
                "audio_desc": None
            }

            countries_data.append(entry)

    return countries_data


def generate_csv(countries_data):
    """Generate countries.csv file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    csv_path = CSV_DIR / "countries.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["countries", "downloaded_ts", "json_generated_ts", "description", "audio_generated_ts"])

        for country in countries_data:
            writer.writerow([
                country["name"],
                timestamp,
                timestamp,
                "",  # description is blank
                ""   # audio_generated_ts is empty
            ])

    print(f"Generated {csv_path} with {len(countries_data)} countries")
    return csv_path


def generate_learn_json(countries_data):
    """Generate countries.json for the learn section."""
    json_path = JSON_DIR / "countries.json"
    json_path.parent.mkdir(parents=True, exist_ok=True)

    learn_data = []
    for country in countries_data:
        entry = {
            "name": country["name"],
            "description": country["display_name"],  # Use display name with continent
            "images": country["images"],
            "videos": country["videos"],
            "audio_desc": None
        }
        learn_data.append(entry)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(learn_data, f, indent=2)
        f.write("\n")

    print(f"Generated {json_path} with {len(learn_data)} countries")
    return json_path


def generate_quiz(countries_data):
    """Generate countries quiz with 15 MC and 5 matching questions."""
    quiz = {
        "quizTitle": "Countries Quiz",
        "showCorrectAnswer": "Y",
        "questions": []
    }

    # Filter countries that have images for the quiz
    valid_countries = [c for c in countries_data if c["images"]]

    if len(valid_countries) < 20:
        print(f"Warning: Not enough countries with images for full quiz ({len(valid_countries)} found)")

    # Generate 15 multiple choice questions
    mc_countries = random.sample(valid_countries, min(15, len(valid_countries)))

    for country in mc_countries:
        # Create question with country image
        wrong_answers = random.sample(
            [c["display_name"] for c in valid_countries if c["name"] != country["name"]],
            min(3, len(valid_countries) - 1)
        )

        choices = [country["display_name"]] + wrong_answers
        random.shuffle(choices)

        correct_letter = chr(ord('a') + choices.index(country["display_name"]))

        question = {
            "questionText": "Which country is this?",
            "centralImage": [country["images"][0]],
            "choiceType": "text",
            "choices": choices,
            "correctAnswer": correct_letter
        }

        quiz["questions"].append(question)

    # Generate 5 matching questions
    match_countries = random.sample(valid_countries, min(5, len(valid_countries)))

    pairs = []
    for country in match_countries:
        pairs.append({
            "left": country["display_name"],
            "right": country["images"][0]
        })

    matching_question = {
        "questionText": "Match the country to its map:",
        "choiceType": "match",
        "leftType": "text",
        "rightType": "image",
        "pairs": pairs
    }

    quiz["questions"].append(matching_question)

    # Save quiz file
    quizzes_dir = QUIZ_APP_ROOT / "public" / "quizzes"
    quizzes_dir.mkdir(parents=True, exist_ok=True)

    quiz_path = quizzes_dir / "countries_quiz.json"
    with open(quiz_path, 'w', encoding='utf-8') as f:
        json.dump(quiz, f, indent=2)
        f.write("\n")

    print(f"Generated {quiz_path} with 15 MC questions and 1 matching question (5 pairs)")
    return quiz_path


def copy_images_to_public(countries_data):
    """Copy country map images to public directory."""
    public_images_dir = PUBLIC_DIR / "countries_images"

    for continent in CONTINENTS:
        continent_path = COUNTRIES_SOURCE / "maps" / "countries" / continent
        if not continent_path.exists():
            continue

        dest_continent_dir = public_images_dir / continent
        dest_continent_dir.mkdir(parents=True, exist_ok=True)

        for img_file in continent_path.glob("*"):
            if img_file.is_file() and img_file.suffix.lower() in ['.gif', '.jpg', '.png', '.jpeg']:
                dest_file = dest_continent_dir / img_file.name
                if not dest_file.exists():
                    with open(img_file, 'rb') as src:
                        with open(dest_file, 'wb') as dst:
                            dst.write(src.read())

    print(f"Copied country images to {public_images_dir}")


def update_quizzes_manifest():
    """Update quizzes manifest to include countries quiz."""
    manifest_path = QUIZZES_DIR / "manifest.json"

    if manifest_path.exists():
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    else:
        manifest = {"quizzes": []}

    # Add countries quiz if not already present
    quiz_titles = [q.get("title", "") for q in manifest.get("quizzes", [])]
    if "Quiz 7: Countries" not in quiz_titles:
        manifest["quizzes"].append({
            "title": "Quiz 7: Countries",
            "file": "quizzes/countries_quiz.json"
        })

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"Updated {manifest_path}")


def main():
    print("Generating countries data...")

    # Generate main data structure
    countries_data = generate_countries_data()
    print(f"Found {len(countries_data)} countries with images")

    if not countries_data:
        print("Error: No countries found with images")
        return

    # Generate CSV
    generate_csv(countries_data)

    # Generate learn JSON
    generate_learn_json(countries_data)

    # Copy images to public
    copy_images_to_public(countries_data)

    # Generate quiz
    generate_quiz(countries_data)

    # Update quizzes manifest
    update_quizzes_manifest()

    print("Done!")


if __name__ == "__main__":
    main()
