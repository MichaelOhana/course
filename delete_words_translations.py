#!/usr/bin/env python3
"""
One-time script to delete all translations from the words_translations table.
This script will:
1. Connect to the SQLite database
2. Count existing translations before deletion
3. Delete all records from words_translations table
4. Confirm the deletion
5. Close the database connection

WARNING: This operation is irreversible. Make sure you have a backup if needed.
"""

import sqlite3
import os

# Database configuration
DB_FILE_PATH = "100_EN_real_estate.sqlite3"

def delete_all_words_translations():
    """Delete all translations from the words_translations table."""
    
    # Check if database file exists
    if not os.path.exists(DB_FILE_PATH):
        print(f"Error: Database file '{DB_FILE_PATH}' not found.")
        print("Please make sure the database file exists in the current directory.")
        return False
    
    try:
        # Connect to the database
        print(f"Connecting to database: {DB_FILE_PATH}")
        conn = sqlite3.connect(DB_FILE_PATH)
        cursor = conn.cursor()
        
        # Count existing translations before deletion
        cursor.execute("SELECT COUNT(*) FROM words_translations")
        count_before = cursor.fetchone()[0]
        print(f"Found {count_before} translations in words_translations table")
        
        if count_before == 0:
            print("No translations found to delete.")
            conn.close()
            return True
        
        # Ask for confirmation
        print(f"\nWARNING: This will permanently delete all {count_before} translations!")
        confirmation = input("Are you sure you want to proceed? (type 'YES' to confirm): ")
        
        if confirmation != 'YES':
            print("Operation cancelled.")
            conn.close()
            return False
        
        # Delete all translations
        print("Deleting all translations from words_translations table...")
        cursor.execute("DELETE FROM words_translations")
        
        # Get the number of deleted rows
        deleted_count = cursor.rowcount
        
        # Commit the changes
        conn.commit()
        
        # Verify deletion
        cursor.execute("SELECT COUNT(*) FROM words_translations")
        count_after = cursor.fetchone()[0]
        
        print(f"Successfully deleted {deleted_count} translations")
        print(f"Remaining translations in table: {count_after}")
        
        # Close the connection
        conn.close()
        
        print("Database connection closed.")
        print("Operation completed successfully!")
        
        return True
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if 'conn' in locals():
            conn.close()
        return False

def main():
    """Main function to run the deletion script."""
    print("=" * 60)
    print("WORDS TRANSLATIONS DELETION SCRIPT")
    print("=" * 60)
    print()
    
    success = delete_all_words_translations()
    
    if success:
        print("\n✅ Script completed successfully!")
    else:
        print("\n❌ Script failed!")
    
    print("=" * 60)

if __name__ == "__main__":
    main() 