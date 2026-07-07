/************************************************************
 * supabaseConfig.js
 * Supabase 项目配置
 *
 * 注意：
 * - anonKey 是 Supabase 前端公开密钥，不是 service_role 密钥。
 * - 访问密钥通过 Supabase RPC 验证，正确密钥不要写入前端。
 ************************************************************/

window.CLASS_RECORD_SUPABASE = {
    url: "https://xyeftofxlxbpqctuuqup.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5ZWZ0b2Z4bHhicHFjdHV1cXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTM2NTMsImV4cCI6MjA5Nzk2OTY1M30.ympDVX6Hqbscc9BWzWLU8Ur-FUNgD3kGaLsrt9o0Gkg",
    tables: {
        records: "class_records",
        people: "class_people",
        recordPages: "class_record_pages",
        pageMessages: "class_page_messages",
        pageSupplements: "class_page_supplements",
        materials: "class_materials",
        quizQuestions: "class_quiz_questions"
    },
    storage: {
        privateBucket: "classrecord-private",
        signedUrlExpiresIn: 600
    },
    useSecureContent: true
};
