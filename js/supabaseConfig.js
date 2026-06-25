/************************************************************
 * supabaseConfig.js
<<<<<<< HEAD
 * Supabase project configuration.
 *
 * Notes:
 * - anonKey is the public browser key, not the service_role key.
 * - accountDomain converts short class accounts into Supabase Auth emails.
=======
 * Supabase 项目配置
 *
 * 注意：
 * - anonKey 是 Supabase 前端公开密钥，不是 service_role 密钥。
 * - accountDomain 用于把“初始账号”转换成邮箱登录；例如账号 zhangsan
 *   会按 zhangsan@classrecord.local 提交给 Supabase Auth。
>>>>>>> parent of df4efb0 (add)
 ************************************************************/

window.CLASS_RECORD_SUPABASE = {
    url: "https://ycpkjuidcgisqkanjzxg.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljcGtqdWlkY2dpc3FrYW5qenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTQxMjcsImV4cCI6MjA5NzYzMDEyN30.0JVeYf9XVyXCgp_fkqcye7LBcXEmJo8gR8-fYundcjQ",
    accountDomain: "classrecord.local",
    tables: {
        profiles: "profiles",
        reactions: "record_reactions",
        comments: "record_comments",
        records: "class_records",
        people: "class_people",
        glossary: "class_glossary",
        recordPages: "class_record_pages",
        quizQuestions: "class_quiz_questions"
    },
    storage: {
        privateBucket: "classrecord-private",
        signedUrlExpiresIn: 600
    },
    useSecureContent: true
};
