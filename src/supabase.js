import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// .env.local이 비어 있으면 화면에서 설정 안내를 보여 준다
export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null
