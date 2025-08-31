"""
auto_improvement.py

This script provides continuous improvement utilities for the cotizador. It generates
suggestions for new synonyms based on the current inventory of products and existing
synonyms mapping. Run this script periodically to update `new_synonyms_suggestions.json`
with potential new synonyms for each product's canonical name.

Usage:
    python auto_improvement.py
"""

import json
import os
import difflib

INVENTORY_FILE = "aaa_inventory_products.json"
SYNONYMS_FILE = "synonyms.json"
OUTPUT_FILE = "new_synonyms_suggestions.json"

def load_json(filename):
    """Load JSON data from a file if it exists, otherwise return an empty list."""
    if not os.path.exists(filename):
        return []
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_synonym_suggestions(inventory_file=INVENTORY_FILE,
                                 synonyms_file=SYNONYMS_FILE,
                                 output_file=OUTPUT_FILE):
    """
    Generate suggestions for new synonyms based on inventory product names.

    This function reads the inventory and existing synonyms, then suggests new synonyms by
    extracting descriptive words from product names that are not already included in the
    synonyms list for each canonical name. Suggestions are saved to a JSON file.
    """
    synonyms_map = {}
    for item in load_json(synonyms_file):
        canonical = item.get('canonical')
        if canonical:
            synonyms_map[canonical] = set(item.get('synonyms', []))

    inventory = load_json(inventory_file)
    suggestions = {}

    for item in inventory:
        name = item.get('Name', '') or item.get('nombre', '')
        if not name:
            continue
        # Use the first word of the name (uppercased) as the canonical candidate
        canonical = name.split()[0].upper()
        if canonical not in synonyms_map:
            synonyms_map[canonical] = set()

        # Generate tokens from the product name
        tokens = [token.strip(".,()\"'").lower()
                  for token in name.replace('-', ' ').split()
                  if len(token) >= 3]
        for token in tokens:
            # Skip numeric tokens
            if token.isdigit():
                continue
            if token not in synonyms_map[canonical]:
                synonyms_map[canonical].add(token)
                suggestions.setdefault(canonical, []).append(token)

    # Write suggestions to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(suggestions, f, ensure_ascii=False, indent=2)
    print(f"Generated suggestions for {len(suggestions)} canonical names.")
    print(f"Suggestions saved to {output_file}")

if __name__ == "__main__":
    generate_synonym_suggestions()
