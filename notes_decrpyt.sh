#!/bin/bash

# Decrypt the file and output to a temporary file
gpg --output notes.dec.md --decrypt notes.gpg.md

# Check if the decryption was successful
if [ $? -eq 0 ]; then
    # If successful, replace the original file with the decrypted one
    mv notes.dec.md notes.gpg.md
    echo "Decryption successful. File replaced."
else
    # If decryption failed, inform the user
    echo "Decryption failed."
    # Optionally, you can choose to remove the temporary decrypted file if needed
    # rm -f notes.dec.md
fi
