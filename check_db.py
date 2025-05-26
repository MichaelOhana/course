import sqlite3

# Connect to the database
conn = sqlite3.connect('100_EN_real_estate.sqlite3')
cursor = conn.cursor()

# Check if conversation_lines table exists and has data
cursor.execute("SELECT COUNT(*) FROM conversation_lines")
total_conversations = cursor.fetchone()[0]
print(f"Total conversation lines in database: {total_conversations}")

if total_conversations > 0:
    # Find a word that has conversations
    cursor.execute('''
        SELECT DISTINCT word_id 
        FROM conversation_lines 
        LIMIT 5
    ''')
    word_ids = cursor.fetchall()
    print(f"Words with conversations: {[w[0] for w in word_ids]}")
    
    # Get conversation lines for the first word with conversations
    word_id = word_ids[0][0]
    print(f"\nChecking conversations for word ID: {word_id}")
    
    cursor.execute('''
        SELECT id, speaker_label, line_order, text 
        FROM conversation_lines 
        WHERE word_id = ? 
        ORDER BY line_order
    ''', (word_id,))
    
    rows = cursor.fetchall()
    print(f"\nFound {len(rows)} conversation lines:")
    print("-" * 80)
    
    for row in rows:
        print(f"ID: {row[0]}, Speaker: {row[1]}, Order: {row[2]}")
        print(f"Text: {row[3]}")
        print("-" * 40)
else:
    print("No conversation lines found in the database")

conn.close() 