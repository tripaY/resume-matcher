-- =============================================================================
-- Supabase / PostgreSQL 初始化脚本 (通用 RLS 版)
-- =============================================================================

-- 1. 基础环境设置
-- =============================================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. 通用 RLS 策略生成函数 (Utility Functions)
-- 必须在建表和应用策略之前定义
-- =============================================================================

-- 2.1 启用"维度表"通用策略
-- 规则: 所有人可读 (Select), 只有管理员可写 (Insert/Update/Delete)
CREATE OR REPLACE FUNCTION enable_dimension_rls(table_name text) RETURNS void AS $$
BEGIN
    -- 启用 RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

    -- 策略 1: 公开读取
    EXECUTE format('CREATE POLICY "Dimension Public Read" ON %I FOR SELECT USING (true)', table_name);
    
    -- 策略 2: 管理员完全控制 (依赖 public.is_admin())
    EXECUTE format('CREATE POLICY "Dimension Admin Write" ON %I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.4 启用"存储桶"通用策略 (Storage Bucket)
-- 规则: 指定桶公开读 (可选), 只有拥有者可写
-- 参数: bucket_name, public_read (默认 true)
CREATE OR REPLACE FUNCTION enable_storage_rls(bucket_name text, public_read boolean DEFAULT true) RETURNS void AS $$
BEGIN
    -- 注意: storage.objects 通常默认已启用 RLS，且普通用户(非超级管理员)可能无权修改其属性
    -- 因此跳过 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    -- 如果需要确保开启，请使用 Dashboard 或超级管理员权限执行

    -- 策略 1: 读取权限 (公开或私有)
    IF public_read THEN
        EXECUTE format(
            'CREATE POLICY "Storage Public Read %s" ON storage.objects FOR SELECT ' ||
            'USING (bucket_id = %L)',
            bucket_name, bucket_name
        );
    ELSE
        EXECUTE format(
            'CREATE POLICY "Storage Owner Read %s" ON storage.objects FOR SELECT ' ||
            'USING (bucket_id = %L AND auth.uid() = owner)',
            bucket_name, bucket_name
        );
    END IF;

    -- 策略 2: 拥有者写入 (Insert)
    EXECUTE format(
        'CREATE POLICY "Storage Owner Write %s" ON storage.objects FOR INSERT ' ||
        'WITH CHECK (bucket_id = %L AND auth.uid() = owner)',
        bucket_name, bucket_name
    );
    
    -- 策略 3: 拥有者更新 (Update)
    EXECUTE format(
        'CREATE POLICY "Storage Owner Update %s" ON storage.objects FOR UPDATE ' ||
        'USING (bucket_id = %L AND auth.uid() = owner)',
        bucket_name, bucket_name
    );
    
    -- 策略 4: 拥有者删除 (Delete)
    EXECUTE format(
        'CREATE POLICY "Storage Owner Delete %s" ON storage.objects FOR DELETE ' ||
        'USING (bucket_id = %L AND auth.uid() = owner)',
        bucket_name, bucket_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.2 启用"业务表"通用策略 (Owner 模式)
-- 规则: 拥有者 (userid_col) 和 管理员 可 CRUD
-- 参数: table_name, userid_col (默认 user_id)
CREATE OR REPLACE FUNCTION enable_owner_rls(table_name text, userid_col text DEFAULT 'user_id') RETURNS void AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

    -- 策略: userid_col = auth.uid() OR is_admin()
    EXECUTE format(
        'CREATE POLICY "Owner and Admin Full Access" ON %I FOR ALL ' ||
        'USING (auth.uid() = %I OR public.is_admin()) ' ||
        'WITH CHECK (auth.uid() = %I OR public.is_admin())', 
        table_name, userid_col, userid_col
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.3 启用"子表"通用策略 (Parent Owner 模式)
-- 规则: 权限继承自父表 (如 Experience 继承 Resume 的 user_id)
-- 参数: table_name (子表名), parent_table (父表名), fk_col (外键列名)
CREATE OR REPLACE FUNCTION enable_child_rls(table_name text, parent_table text, fk_col text) RETURNS void AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

    -- 策略: 检查父表中是否存在对应记录，且该记录归当前用户或管理员所有
    EXECUTE format(
        'CREATE POLICY "Parent Owner and Admin Full Access" ON %I FOR ALL ' ||
        'USING (EXISTS (SELECT 1 FROM %I WHERE id = %I.%I AND (user_id = auth.uid() OR public.is_admin()))) ' ||
        'WITH CHECK (EXISTS (SELECT 1 FROM %I WHERE id = %I.%I AND (user_id = auth.uid() OR public.is_admin())))',
        table_name, parent_table, table_name, fk_col, parent_table, table_name, fk_col
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. 用户档案 (Profiles) & 权限基础
-- =============================================================================

-- 3.1 角色表 (Lookup Table)
CREATE TABLE IF NOT EXISTS public.roles (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'admin', 'recruiter'
    name VARCHAR(50) NOT NULL   -- e.g., '管理员', '招聘者'
);
COMMENT ON TABLE public.roles IS '系统角色定义表';
COMMENT ON COLUMN public.roles.id IS '角色ID (主键)';
COMMENT ON COLUMN public.roles.name IS '角色名称';

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 插入默认角色
INSERT INTO public.roles (id, name) VALUES 
('admin', '管理员'),
('candidate', '求职者')
ON CONFLICT (id) DO NOTHING;

-- 3.2 Profiles 表
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) NOT NULL DEFAULT 'candidate' REFERENCES public.roles(id),
    avatar_id UUID REFERENCES storage.objects(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.profiles IS '用户个人资料表，扩展 auth.users 信息';
COMMENT ON COLUMN public.profiles.id IS '用户ID，关联 auth.users';
COMMENT ON COLUMN public.profiles.role_id IS '用户角色ID';
COMMENT ON COLUMN public.profiles.avatar_id IS '用户头像ID，关联 storage.objects';

-- 3.3 管理员检查函数 (核心权限逻辑)
-- 必须在 profiles 表存在后定义
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role_id = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3.4 应用 Profiles 策略 (依赖函数和表都已存在)
SELECT enable_owner_rls('profiles', 'id');
-- 应用 Roles 策略
SELECT enable_dimension_rls('roles');


-- =============================================================================
-- 4. 存储 (Storage)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
SELECT enable_storage_rls('avatars');


-- =============================================================================
-- 5. 维度表定义与 RLS 应用
-- =============================================================================

-- 定义表
CREATE TABLE IF NOT EXISTS public.cities (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, code VARCHAR(50));
COMMENT ON TABLE public.cities IS '城市维度表';

CREATE TABLE IF NOT EXISTS public.career_levels (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, label VARCHAR(50), level INTEGER);
COMMENT ON TABLE public.career_levels IS '职级维度表';
COMMENT ON COLUMN public.career_levels.level IS '职级数值 (用于比较)';

CREATE TABLE IF NOT EXISTS public.industries (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, code VARCHAR(50));
COMMENT ON TABLE public.industries IS '行业维度表';

CREATE TABLE IF NOT EXISTS public.skills (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE);
COMMENT ON TABLE public.skills IS '技能维度表';

CREATE TABLE IF NOT EXISTS public.degrees (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, level INTEGER);
COMMENT ON TABLE public.degrees IS '学历维度表';
COMMENT ON COLUMN public.degrees.level IS '学历等级数值 (用于比较)';

-- 应用通用 RLS
SELECT enable_dimension_rls('cities');
SELECT enable_dimension_rls('career_levels');
SELECT enable_dimension_rls('industries');
SELECT enable_dimension_rls('skills');
SELECT enable_dimension_rls('degrees');


-- =============================================================================
-- 5.1 插入维度表初始数据 (Initial Data)
-- =============================================================================

-- Cities
INSERT INTO public.cities (name) VALUES 
('北京'), ('上海'), ('广州'), ('深圳'), ('杭州'), ('成都'), ('远程')
ON CONFLICT (name) DO NOTHING;

-- Career Levels (name, level)
INSERT INTO public.career_levels (name, label, level) VALUES 
('JUNIOR', '初级', 1),
('MID', '中级', 2),
('SENIOR', '高级', 3),
('EXPERT', '专家', 4)
ON CONFLICT (name) DO NOTHING;

-- Industries
INSERT INTO public.industries (name, code) VALUES 
('互联网', 'internet'),
('金融', 'finance'),
('教育', 'education'),
('医疗健康', 'healthcare'),
('电商', 'e_commerce'),
('人工智能', 'ai'),
('游戏', 'gaming'),
('企业服务', 'saas')
ON CONFLICT (name) DO NOTHING;

-- Skills
INSERT INTO public.skills (name) VALUES 
('Python'), ('Java'), ('Go'), ('Vue3'), ('React'), 
('Docker'), ('Kubernetes'), ('AWS'), ('MySQL'), ('Redis')
ON CONFLICT (name) DO NOTHING;

-- Degrees (name, level)
INSERT INTO public.degrees (name, level) VALUES 
('大专', 1),
('本科', 2),
('硕士', 3),
('博士', 4)
ON CONFLICT (name) DO NOTHING;



-- =============================================================================
-- 6. 业务表定义与 RLS 应用
-- =============================================================================

-- 6.1 主表
-- -----------------------------------------------------------

-- Resumes
CREATE TABLE IF NOT EXISTS public.resumes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    candidate_name VARCHAR(100) NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('M', 'F')),
    expected_city_id INTEGER REFERENCES public.cities(id),
    years_of_experience INTEGER DEFAULT 0,
    current_level_id INTEGER REFERENCES public.career_levels(id),
    expected_title VARCHAR(100),
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.resumes IS '候选人简历表';
COMMENT ON COLUMN public.resumes.user_id IS '所属用户ID';
COMMENT ON COLUMN public.resumes.years_of_experience IS '工作年限';
COMMENT ON COLUMN public.resumes.expected_salary_min IS '期望薪资下限';
COMMENT ON COLUMN public.resumes.expected_salary_max IS '期望薪资上限';

-- 应用 Owner RLS
SELECT enable_owner_rls('resumes');

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    city_id INTEGER REFERENCES public.cities(id),
    min_years INTEGER DEFAULT 0,
    level_id INTEGER REFERENCES public.career_levels(id),
    degree_required_id INTEGER REFERENCES public.degrees(id),
    industry_id INTEGER REFERENCES public.industries(id),
    salary_min INTEGER,
    salary_max INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.jobs IS '职位发布表';
COMMENT ON COLUMN public.jobs.title IS '职位名称';
COMMENT ON COLUMN public.jobs.min_years IS '最低工作年限要求';
COMMENT ON COLUMN public.jobs.degree_required_id IS '最低学历要求ID';

-- 应用 Owner RLS
SELECT enable_owner_rls('jobs');


-- 6.2 子表
-- -----------------------------------------------------------

-- Experiences
CREATE TABLE IF NOT EXISTS public.experiences (
    id BIGSERIAL PRIMARY KEY,
    resume_id BIGINT NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    company_name VARCHAR(100) NOT NULL,
    industry_id INTEGER REFERENCES public.industries(id),
    description TEXT
);
COMMENT ON TABLE public.experiences IS '简历-工作经历表';
COMMENT ON COLUMN public.experiences.resume_id IS '关联简历ID';

-- 应用 Child RLS
SELECT enable_child_rls('experiences', 'resumes', 'resume_id');

-- Educations
CREATE TABLE IF NOT EXISTS public.educations (
    id BIGSERIAL PRIMARY KEY,
    resume_id BIGINT NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    school VARCHAR(100) NOT NULL,
    major_industry_id INTEGER REFERENCES public.industries(id),
    degree_id INTEGER REFERENCES public.degrees(id)
);
COMMENT ON TABLE public.educations IS '简历-教育经历表';
COMMENT ON COLUMN public.educations.resume_id IS '关联简历ID';

-- 应用 Child RLS
SELECT enable_child_rls('educations', 'resumes', 'resume_id');

-- Resume Skills (M2M)
CREATE TABLE IF NOT EXISTS public.resume_skills (
    resume_id BIGINT NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, skill_id)
);
COMMENT ON TABLE public.resume_skills IS '简历-技能关联表';

-- 应用 Child RLS
SELECT enable_child_rls('resume_skills', 'resumes', 'resume_id');

-- Job Skills (M2M)
CREATE TABLE IF NOT EXISTS public.job_skills (
    job_id BIGINT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (job_id, skill_id)
);
COMMENT ON TABLE public.job_skills IS '职位-技能关联表';
COMMENT ON COLUMN public.job_skills.is_required IS '是否为必修技能';
-- 应用 Child RLS
SELECT enable_child_rls('job_skills', 'jobs', 'job_id');


-- 6.3 匹配评估表 (Match Evaluations)
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_evaluations (
    id BIGSERIAL PRIMARY KEY,
    resume_id BIGINT NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    reason TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.match_evaluations IS 'LLM 简历与职位匹配评估结果表';
COMMENT ON COLUMN public.match_evaluations.score IS '匹配得分 (0-100)';
COMMENT ON COLUMN public.match_evaluations.reason IS '匹配原因分析';
COMMENT ON COLUMN public.match_evaluations.is_valid IS '评估是否有效 (简历或职位更新后自动置为false)';

-- RLS: 所有人可读 (Public Read)，只有管理员/Service Role 可写
ALTER TABLE public.match_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evaluations Public Read" ON public.match_evaluations
    FOR SELECT USING (true);

CREATE POLICY "Evaluations Admin Write" ON public.match_evaluations
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 索引
CREATE INDEX IF NOT EXISTS idx_match_evaluations_resume_id ON public.match_evaluations(resume_id);
CREATE INDEX IF NOT EXISTS idx_match_evaluations_job_id ON public.match_evaluations(job_id);


-- =============================================================================
-- 7. 索引优化 (Indexes)
-- 注意: Postgres 不会自动为外键创建索引，建议手动创建以提升 JOIN 和外键检查性能
-- =============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_id ON public.profiles(avatar_id);

-- Resumes
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_expected_city_id ON public.resumes(expected_city_id);
CREATE INDEX IF NOT EXISTS idx_resumes_current_level_id ON public.resumes(current_level_id);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_city_id ON public.jobs(city_id);
CREATE INDEX IF NOT EXISTS idx_jobs_level_id ON public.jobs(level_id);
CREATE INDEX IF NOT EXISTS idx_jobs_degree_required_id ON public.jobs(degree_required_id);
CREATE INDEX IF NOT EXISTS idx_jobs_industry_id ON public.jobs(industry_id);

-- Experiences
CREATE INDEX IF NOT EXISTS idx_experiences_resume_id ON public.experiences(resume_id);
CREATE INDEX IF NOT EXISTS idx_experiences_industry_id ON public.experiences(industry_id);

-- Educations
CREATE INDEX IF NOT EXISTS idx_educations_resume_id ON public.educations(resume_id);
CREATE INDEX IF NOT EXISTS idx_educations_major_industry_id ON public.educations(major_industry_id);
CREATE INDEX IF NOT EXISTS idx_educations_degree_id ON public.educations(degree_id);

-- M2M Tables (主键已包含索引，但为了反向查询优化，可为第二个字段加索引)
CREATE INDEX IF NOT EXISTS idx_resume_skills_skill_id ON public.resume_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill_id ON public.job_skills(skill_id);


-- 8.3 自动创建用户档案
-- 当 auth.users 新增记录时，自动在 public.profiles 创建对应记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role_id)
    VALUES (NEW.id, 'candidate') -- 默认为求职者，无头像
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 绑定触发器到 auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 9. 核心匹配算法 (Core Match Algorithm)
-- =============================================================================

-- 计算简历与职位的硬性匹配得分 (0-80分)，剩余20分由LLM评估
CREATE OR REPLACE FUNCTION public.calculate_match_score(
    p_resume_id BIGINT,
    p_job_id BIGINT
)
RETURNS TABLE (
    total_score NUMERIC,
    details JSONB
) AS $$
DECLARE
    -- Resume Data
    v_r_city_id INT;
    v_r_years INT;
    v_r_level_val INT;
    v_r_degree_val INT;
    v_r_salary_min INT;
    v_r_skill_ids INT[];
    v_r_industry_ids INT[];
    
    -- Job Data
    v_j_city_id INT;
    v_j_min_years INT;
    v_j_level_val INT;
    v_j_degree_val INT;
    v_j_salary_max INT;
    v_j_industry_id INT;
    v_j_req_skill_ids INT[];
    v_j_nice_skill_ids INT[];
    
    -- Scores
    s_skills NUMERIC := 0;
    s_exp NUMERIC := 0;
    s_degree NUMERIC := 0;
    s_level NUMERIC := 0;
    s_salary NUMERIC := 0;
    s_industry NUMERIC := 0;
    s_city NUMERIC := 0;
    
    -- Helpers
    v_total_req INT;
    v_match_req INT;
    v_match_nice INT;
BEGIN
    -- 1. Fetch Job Info
    SELECT 
        j.city_id, j.min_years, cl.level, d.level, j.salary_max, j.industry_id,
        ARRAY(SELECT skill_id FROM job_skills WHERE job_id = j.id AND is_required = true),
        ARRAY(SELECT skill_id FROM job_skills WHERE job_id = j.id AND is_required = false)
    INTO 
        v_j_city_id, v_j_min_years, v_j_level_val, v_j_degree_val, v_j_salary_max, v_j_industry_id, v_j_req_skill_ids, v_j_nice_skill_ids
    FROM jobs j
    LEFT JOIN career_levels cl ON j.level_id = cl.id
    LEFT JOIN degrees d ON j.degree_required_id = d.id
    WHERE j.id = p_job_id;

    -- 2. Fetch Resume Info
    SELECT 
        r.expected_city_id, r.years_of_experience, cl.level, r.expected_salary_min,
        (SELECT MAX(d.level) FROM educations e JOIN degrees d ON e.degree_id = d.id WHERE e.resume_id = r.id),
        ARRAY(SELECT skill_id FROM resume_skills WHERE resume_id = r.id),
        ARRAY(SELECT industry_id FROM experiences WHERE resume_id = r.id AND industry_id IS NOT NULL)
    INTO 
        v_r_city_id, v_r_years, v_r_level_val, v_r_salary_min, v_r_degree_val, v_r_skill_ids, v_r_industry_ids
    FROM resumes r
    LEFT JOIN career_levels cl ON r.current_level_id = cl.id
    WHERE r.id = p_resume_id;

    -- 3. Calculate Scores (Total 80 pts Deterministic + 20 pts LLM)
    
    -- 3.1 Skills (30 pts): 25 for Required, 5 for Nice
    v_total_req := array_length(v_j_req_skill_ids, 1);
    
    -- Required Skills
    IF v_total_req IS NULL OR v_total_req = 0 THEN
        s_skills := 25; -- No requirements implies full match
    ELSE
        SELECT COUNT(*) INTO v_match_req
        FROM unnest(v_j_req_skill_ids) x
        WHERE x = ANY(v_r_skill_ids);
        s_skills := (v_match_req::numeric / v_total_req) * 25;
    END IF;
    
    -- Nice-to-have Skills (Bonus up to 5)
    SELECT COUNT(*) INTO v_match_nice
    FROM unnest(v_j_nice_skill_ids) x
    WHERE x = ANY(v_r_skill_ids);
    IF v_match_nice > 0 THEN
        s_skills := s_skills + LEAST(v_match_nice * 2, 5);
    END IF;

    -- 3.2 Experience (10 pts)
    IF COALESCE(v_r_years, 0) >= COALESCE(v_j_min_years, 0) THEN
        s_exp := 10;
    END IF;

    -- 3.3 Degree (10 pts)
    IF COALESCE(v_r_degree_val, 0) >= COALESCE(v_j_degree_val, 0) THEN
        s_degree := 10;
    END IF;

    -- 3.4 Level (10 pts)
    IF COALESCE(v_r_level_val, 0) >= COALESCE(v_j_level_val, 0) THEN
        s_level := 10;
    END IF;
    
    -- 3.5 Salary (10 pts) - Resume Min <= Job Max
    IF v_r_salary_min IS NULL OR v_j_salary_max IS NULL OR v_r_salary_min <= v_j_salary_max THEN
        s_salary := 10;
    END IF;
    
    -- 3.6 Industry (5 pts) - Any experience in job industry
    IF v_j_industry_id IS NOT NULL AND v_j_industry_id = ANY(v_r_industry_ids) THEN
        s_industry := 5;
    END IF;
    
    -- 3.7 City (5 pts)
    IF v_r_city_id = v_j_city_id OR v_j_city_id = (SELECT id FROM cities WHERE code = 'REMOTE') THEN
        s_city := 5;
    END IF;

    -- Result
    total_score := s_skills + s_exp + s_degree + s_level + s_salary + s_industry + s_city;
    details := jsonb_build_object(
        'skills', s_skills,
        'experience', s_exp,
        'degree', s_degree,
        'level', s_level,
        'salary', s_salary,
        'industry', s_industry,
        'city', s_city
    );
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 10. 初始化管理员账户 (Admin User)
-- =============================================================================
-- 8. 触发器与自动化 (Triggers)
-- =============================================================================

-- 8.1 自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 应用到 Profiles
DROP TRIGGER IF EXISTS tr_update_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 应用到 Resumes
DROP TRIGGER IF EXISTS tr_update_resumes_updated_at ON public.resumes;
CREATE TRIGGER tr_update_resumes_updated_at
    BEFORE UPDATE ON public.resumes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 应用到 Jobs
DROP TRIGGER IF EXISTS tr_update_jobs_updated_at ON public.jobs;
CREATE TRIGGER tr_update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 应用到 Match Evaluations
DROP TRIGGER IF EXISTS tr_update_evaluations_updated_at ON public.match_evaluations;
CREATE TRIGGER tr_update_evaluations_updated_at
    BEFORE UPDATE ON public.match_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- 8.2 自动失效匹配评估
-- 当简历或职位更新时，将相关的匹配评估标记为无效
CREATE OR REPLACE FUNCTION public.invalidate_match_evaluations()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'resumes' THEN
        UPDATE public.match_evaluations
        SET is_valid = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE resume_id = NEW.id AND is_valid = TRUE;
    ELSIF TG_TABLE_NAME = 'jobs' THEN
        UPDATE public.match_evaluations
        SET is_valid = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = NEW.id AND is_valid = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 绑定触发器到 Resumes
DROP TRIGGER IF EXISTS tr_invalidate_evaluations_on_resume_update ON public.resumes;
CREATE TRIGGER tr_invalidate_evaluations_on_resume_update
    AFTER UPDATE ON public.resumes
    FOR EACH ROW
    EXECUTE FUNCTION public.invalidate_match_evaluations();

-- 绑定触发器到 Jobs
DROP TRIGGER IF EXISTS tr_invalidate_evaluations_on_job_update ON public.jobs;
CREATE TRIGGER tr_invalidate_evaluations_on_job_update
    AFTER UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.invalidate_match_evaluations();


