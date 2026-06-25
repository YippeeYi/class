/************************************************************
 * supabaseConfig.js
 * Supabase project configuration.
 *
 * Notes:
 * - anonKey is the public browser key, not the service_role key.
 * - accountDomain converts short class accounts into Supabase Auth emails.
 ************************************************************/

window.CLASS_RECORD_SUPABASE = {
    url: "https://ycpkjuidcgisqkanjzxg.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljcGtqdWlkY2dpc3FrYW5qenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTQxMjcsImV4cCI6MjA5NzYzMDEyN30.0JVeYf9XVyXCgp_fkqcye7LBcXEmJo8gR8-fYundcjQ",
    accountDomain: "classrecord.local",
    tables: {
        profiles: "profiles",
        reactions: "record_reactions",
        comments: "record_comments",
        commentLikes: "comment_likes",
        corrections: "correction_reports",
        wallMessages: "wall_messages",
        personClaims: "person_claim_requests",
        personEdits: "person_edit_requests",
        admins: "admin_users",
        records: "class_records",
        hiddenRecords: "class_hidden_records",
        people: "class_people",
        glossary: "class_glossary",
        recordPages: "class_record_pages",
        quizQuestions: "class_quiz_questions"
    },
    storage: {
        privateBucket: "classrecord-private",
        publicPrefix: "",
        signedUrlExpiresIn: 600
    },
    useSecureContent: true
};
