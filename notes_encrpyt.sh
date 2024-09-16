#!/bin/bash

# Encrypt the file and output to a temporary encrypted file
gpg --output notes.enc.md --encrypt --armor --trust-model always --recipient FB0E6BAEE44B9180B672BAD93C062BF0F1EBFF74 notes.gpg.md

# Check if the encryption was successful
if [ $? -eq 0 ]; then
    # If successful, replace the original file with the encrypted one
    mv notes.enc.md notes.gpg.md
    echo "Encryption successful. Original file removed and replaced with encrypted version."
else
    # If encryption failed, inform the user
    echo "Encryption failed."
    # Optionally, you can choose to remove the temporary encrypted file if needed
    # rm -f notes.gpg.md
fi

