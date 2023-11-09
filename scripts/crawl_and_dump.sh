#!/bin/bash

# Check if URL is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <website-url>"
    exit 1
fi

# Assign the first argument as the URL
URL=$1

# Extract domain name for output filename
DOMAIN=$(echo $URL | awk -F[/:] '{print $4}')

# Directory where the website will be mirrored
MIRROR_DIR="/tmp/crawl_and_dump/${DOMAIN}"

# Output file named after the domain
OUTPUT_FILE="./${DOMAIN}.txt"

# Create mirror directory
mkdir -p "$MIRROR_DIR"

# Use wget to download the content based on MIME-type
wget --referer "$URL" --user-agent="Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36" --recursive --no-clobber --page-requisites --convert-links --adjust-extension --domains "$DOMAIN" --no-parent --execute robots=off --reject "jpg,jpeg,gif,png,css,js" --directory-prefix="$MIRROR_DIR" "$URL"

# Find all HTML files in the mirror directory, dump the content to text files,
# and append them into the single output file, while removing the References section.
find "$MIRROR_DIR" -name "*.html" -exec sh -c 'lynx -dump "$1" | sed "/References/,\$d" >> "$2"' _ {} "$OUTPUT_FILE" \;

# Inform the user that the script has finished
echo "Website crawling, text dumping, and merging completed."
echo "The merged content is in $OUTPUT_FILE."
