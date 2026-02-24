--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: audit_trigger_function(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_trigger_function() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields JSONB;
    v_record_id INTEGER;
    v_user_id INTEGER;
    v_username VARCHAR(255);
    v_ip_address INET;
    v_session_token VARCHAR(255);
    v_sql_command TEXT;
    v_action VARCHAR(20);
    v_is_soft_delete BOOLEAN := FALSE;
BEGIN
    -- Intentar obtener información del contexto de la aplicación
    BEGIN
        v_user_id := current_setting('audit.user_id', true)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    
    BEGIN
        v_username := current_setting('audit.username', true);
    EXCEPTION WHEN OTHERS THEN
        v_username := current_user;
    END;
    
    BEGIN
        v_ip_address := current_setting('audit.ip_address', true)::INET;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;
    
    BEGIN
        v_session_token := current_setting('audit.session_token', true);
    EXCEPTION WHEN OTHERS THEN
        v_session_token := NULL;
    END;

    -- Determinar el tipo de operación y capturar datos
    IF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        v_old_data := NULL;
        v_changed_fields := v_new_data;
        
        -- Safe extraction of ID
        IF (v_new_data ? 'id') THEN
            v_record_id := (v_new_data ->> 'id')::INTEGER;
        ELSE
            v_record_id := NULL;
        END IF;

        v_sql_command := 'INSERT INTO ' || TG_TABLE_NAME;
        v_action := 'INSERT';
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Safe extraction of ID
        IF (v_new_data ? 'id') THEN
            v_record_id := (v_new_data ->> 'id')::INTEGER;
        ELSE
            v_record_id := NULL;
        END IF;
        
        -- Calcular solo los campos que cambiaron
        SELECT jsonb_object_agg(key, value) INTO v_changed_fields
        FROM (
            SELECT n.key, n.value
            FROM jsonb_each(v_new_data) n
            LEFT JOIN jsonb_each(v_old_data) o ON n.key = o.key
            WHERE n.value IS DISTINCT FROM o.value
        ) changes;

        v_sql_command := 'UPDATE ' || TG_TABLE_NAME;
        v_action := 'UPDATE';

        -- Detección de Borrado Lógico (Soft Delete)
        IF (v_new_data ? 'deleted_at') THEN
            IF ((v_old_data ->> 'deleted_at') IS NULL OR (v_old_data ->> 'deleted_at') = 'null') 
               AND ((v_new_data ->> 'deleted_at') IS NOT NULL AND (v_new_data ->> 'deleted_at') <> 'null') THEN
                v_is_soft_delete := TRUE;
                v_action := 'SOFT_DELETE';
            END IF;
        END IF;
        
        -- Apéndice de ID al comando SQL solo si tenemos ID
        IF v_record_id IS NOT NULL THEN
             v_sql_command := v_sql_command || ' WHERE id = ' || v_record_id;
        END IF;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_changed_fields := NULL;
        
        -- Safe extraction of ID
        IF (v_old_data ? 'id') THEN
            v_record_id := (v_old_data ->> 'id')::INTEGER;
        ELSE
            v_record_id := NULL;
        END IF;

        v_sql_command := 'DELETE FROM ' || TG_TABLE_NAME;
        IF v_record_id IS NOT NULL THEN
             v_sql_command := v_sql_command || ' WHERE id = ' || v_record_id;
        END IF;
        
        v_action := 'DELETE';
    END IF;

    -- Insertar registro de auditoría
    INSERT INTO public.audit_logs (
        user_id,
        username,
        ip_address,
        table_name,
        action,
        record_id,
        old_data,
        new_data,
        changed_fields,
        sql_command,
        session_token
    ) VALUES (
        v_user_id,
        v_username,
        v_ip_address,
        TG_TABLE_NAME,
        v_action,
        v_record_id,
        v_old_data,
        v_new_data,
        v_changed_fields,
        v_sql_command,
        v_session_token
    );

    -- Retornar el registro apropiado
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION public.audit_trigger_function() OWNER TO postgres;

--
-- Name: set_audit_context(integer, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_audit_context(p_user_id integer DEFAULT NULL::integer, p_username character varying DEFAULT NULL::character varying, p_ip_address character varying DEFAULT NULL::character varying, p_session_token character varying DEFAULT NULL::character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Usamos false en el tercer parámetro para que la configuración dure toda la sesión actual
    -- y no se pierda al terminar la "transacción" implícita de esta llamada.
    -- Manejamos NULLs convirtiéndolos a strings vacíos o cadenas nulas que el trigger sepa manejar.
    
    PERFORM set_config('audit.user_id', COALESCE(p_user_id::TEXT, ''), false);
    PERFORM set_config('audit.username', COALESCE(p_username, ''), false);
    PERFORM set_config('audit.ip_address', COALESCE(p_ip_address, ''), false);
    PERFORM set_config('audit.session_token', COALESCE(p_session_token, ''), false);
END;
$$;


ALTER FUNCTION public.set_audit_context(p_user_id integer, p_username character varying, p_ip_address character varying, p_session_token character varying) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    username character varying(255),
    ip_address inet,
    table_name character varying(100) NOT NULL,
    action character varying(20) NOT NULL,
    record_id integer,
    old_data jsonb,
    new_data jsonb,
    changed_fields jsonb,
    sql_command text,
    action_timestamp timestamp(6) without time zone DEFAULT now(),
    session_token character varying(255),
    CONSTRAINT audit_logs_action_check CHECK (((action)::text = ANY (ARRAY[('INSERT'::character varying)::text, ('UPDATE'::character varying)::text, ('DELETE'::character varying)::text, ('SOFT_DELETE'::character varying)::text])))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'Tabla de auditoría para registro de todas las operaciones CRUD del sistema';


--
-- Name: COLUMN audit_logs.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.user_id IS 'ID del usuario que realizó la acción';


--
-- Name: COLUMN audit_logs.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.username IS 'Nombre de usuario (respaldo si no hay user_id)';


--
-- Name: COLUMN audit_logs.ip_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.ip_address IS 'Dirección IP desde donde se realizó la acción';


--
-- Name: COLUMN audit_logs.table_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.table_name IS 'Nombre de la tabla afectada';


--
-- Name: COLUMN audit_logs.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.action IS 'Tipo de acción: INSERT, UPDATE, DELETE';


--
-- Name: COLUMN audit_logs.record_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.record_id IS 'ID del registro afectado';


--
-- Name: COLUMN audit_logs.old_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.old_data IS 'Datos antes de la modificación (JSON)';


--
-- Name: COLUMN audit_logs.new_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.new_data IS 'Datos después de la modificación (JSON)';


--
-- Name: COLUMN audit_logs.changed_fields; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.changed_fields IS 'Solo los campos que cambiaron (para UPDATE)';


--
-- Name: COLUMN audit_logs.sql_command; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.sql_command IS 'Comando SQL aproximado ejecutado';


--
-- Name: COLUMN audit_logs.action_timestamp; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.action_timestamp IS 'Fecha y hora de la acción';


--
-- Name: COLUMN audit_logs.session_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.session_token IS 'Token de sesión del usuario';


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: blacklisted_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.blacklisted_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.blacklisted_tokens_id_seq OWNER TO postgres;

--
-- Name: blacklisted_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blacklisted_tokens (
    id integer DEFAULT nextval('public.blacklisted_tokens_id_seq'::regclass) NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone DEFAULT now()
);


ALTER TABLE public.blacklisted_tokens OWNER TO postgres;

--
-- Name: email_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_verifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.email_verifications_id_seq OWNER TO postgres;

--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_verifications (
    id integer DEFAULT nextval('public.email_verifications_id_seq'::regclass) NOT NULL,
    user_id integer,
    token character varying(255) NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone DEFAULT now(),
    updated_at timestamp(6) without time zone,
    deleted_at timestamp(6) without time zone
);


ALTER TABLE public.email_verifications OWNER TO postgres;

--
-- Name: login_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.login_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.login_logs_id_seq OWNER TO postgres;

--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_logs (
    id integer DEFAULT nextval('public.login_logs_id_seq'::regclass) NOT NULL,
    user_id integer,
    username character varying(255) NOT NULL,
    ip_address inet NOT NULL,
    login_timestamp timestamp(6) without time zone DEFAULT now(),
    login_status character varying(50) NOT NULL,
    logout_type character varying(50),
    logout_timestamp timestamp(6) without time zone,
    session_token character varying(255)
);


ALTER TABLE public.login_logs OWNER TO postgres;

--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_categories (
    id integer NOT NULL,
    name text NOT NULL,
    icon text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.menu_categories OWNER TO postgres;

--
-- Name: menu_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.menu_categories_id_seq OWNER TO postgres;

--
-- Name: menu_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    category_id integer,
    title text NOT NULL,
    icon text NOT NULL,
    path text NOT NULL,
    permission_name text,
    parent_id integer,
    item_order integer DEFAULT 0 NOT NULL,
    is_divider boolean DEFAULT false,
    is_header boolean DEFAULT false,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.menu_items OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menu_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO postgres;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: password_resets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_resets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.password_resets_id_seq OWNER TO postgres;

--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_resets (
    id integer DEFAULT nextval('public.password_resets_id_seq'::regclass) NOT NULL,
    user_id integer,
    token character varying(255) NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone DEFAULT now(),
    updated_at timestamp(6) without time zone,
    deleted_at timestamp(6) without time zone
);


ALTER TABLE public.password_resets OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    resource text NOT NULL,
    action text NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO postgres;

--
-- Name: permissions_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq1 OWNER TO postgres;

--
-- Name: permissions_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq1 OWNED BY public.permissions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    session_timeout_min integer
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq1 OWNER TO postgres;

--
-- Name: roles_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq1 OWNED BY public.roles.id;


--
-- Name: session_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session_settings (
    id integer NOT NULL,
    global_timeout integer DEFAULT 120,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_global_setting CHECK ((id = 1))
);


ALTER TABLE public.session_settings OWNER TO postgres;

--
-- Name: session_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.session_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.session_settings_id_seq OWNER TO postgres;

--
-- Name: session_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.session_settings_id_seq OWNED BY public.session_settings.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer,
    token text NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    is_revoked boolean DEFAULT false,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    user_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    cedula integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    is_email_verified boolean DEFAULT false,
    status text DEFAULT 'active'::text,
    is_temporary_password boolean DEFAULT true,
    failed_attempts integer DEFAULT 0,
    lock_until timestamp(6) without time zone,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    session_timeout_min integer,
    failed_login_attempts integer DEFAULT 0,
    last_failed_login timestamp(6) without time zone,
    deleted_at timestamp(6) without time zone,
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deactivated'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.users_id_seq1 OWNER TO postgres;

--
-- Name: users_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq1 OWNED BY public.users.id;


--
-- Name: vaudit_logs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vaudit_logs AS
 SELECT al.id,
    al.action_timestamp AS fecha,
    al.user_id AS id_usuario,
    COALESCE(((u.first_name || ' '::text) || u.last_name), (al.username)::text) AS usuario,
    al.ip_address AS ip,
    al.table_name AS tabla,
    al.action AS accion,
    al.record_id AS id_registro,
    al.old_data AS datos_anteriores,
    al.new_data AS datos_nuevos,
    al.changed_fields AS campos_modificados,
    al.sql_command AS comando_sql
   FROM (public.audit_logs al
     LEFT JOIN public.users u ON ((u.id = al.user_id)))
  ORDER BY al.action_timestamp DESC;


ALTER VIEW public.vaudit_logs OWNER TO postgres;

--
-- Name: vroles_permissions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vroles_permissions AS
 SELECT a.role_id,
    b.name AS rol,
    a.permission_id,
    c.name AS permission,
    c.description
   FROM ((public.role_permissions a
     LEFT JOIN public.roles b ON ((b.id = a.role_id)))
     LEFT JOIN public.permissions c ON ((c.id = a.permission_id)))
  ORDER BY b.name, c.name;


ALTER VIEW public.vroles_permissions OWNER TO postgres;

--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: menu_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq1'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq1'::regclass);


--
-- Name: session_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_settings ALTER COLUMN id SET DEFAULT nextval('public.session_settings_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq1'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: session_settings session_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_settings
    ADD CONSTRAINT session_settings_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_cedula_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_cedula_key UNIQUE (cedula);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_record_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_record_id ON public.audit_logs USING btree (record_id);


--
-- Name: idx_audit_logs_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree (action_timestamp DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: permissions audit_permissions_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_permissions_trigger AFTER INSERT OR DELETE OR UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: role_permissions audit_role_permissions_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_role_permissions_trigger AFTER INSERT OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: roles audit_roles_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_roles_trigger AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: session_settings audit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.session_settings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: user_permissions audit_user_permissions_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_user_permissions_trigger AFTER INSERT OR DELETE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: user_roles audit_user_roles_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_user_roles_trigger AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: users audit_users_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_users_trigger AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_permission_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_permission_name_fkey FOREIGN KEY (permission_name) REFERENCES public.permissions(name) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

