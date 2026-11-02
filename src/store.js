import { configured, supabase } from './supabase.js'
import seed from '../../docs/dummy/seed/products.json'

// Supabase 키가 없으면 브라우저(localStorage)에 저장하는 로컬 모드로 동작한다
export const mode = configured ? 'supabase' : 'local'

// service role 키가 설정돼 있으면(vite.config.js가 판단) 추가 · 삭제를 개발 서버를 거쳐 처리한다
// 키 값은 브라우저에 오지 않고, 여기서는 사용 여부만 안다
const useWriteApi = typeof __WRITE_API__ !== 'undefined' && __WRITE_API__

async function callWriteApi(method, path, body) {
  try {
    const res = await fetch(`/api/products${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Product-Manager': '1' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    return res.ok ? {} : { error: json.error ?? `요청 실패 (${res.status})` }
  } catch (e) {
    return { error: `개발 서버에 연결하지 못했습니다: ${e.message}` }
  }
}

const STORAGE_KEY = 'product-manager-local-v1'

function readLocal() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // 저장값이 깨졌으면 시드로 되돌린다
  }
  return structuredClone(seed)
}

function writeLocal(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

// 모든 함수는 { data, error } 또는 { error } 형태로 돌려준다 (error는 메시지 문자열)

export async function listProducts() {
  if (mode === 'local') {
    const products = readLocal()
    return { data: products.sort((a, b) => a.product_code.localeCompare(b.product_code)) }
  }
  const { data, error } = await supabase
    .from('products')
    .select('*, product_attributes(*)')
    .order('product_code')
  return error ? { error: error.message } : { data }
}

export async function addProduct(product, attrs) {
  if (mode === 'local') {
    const products = readLocal()
    if (products.some((p) => p.product_code === product.product_code)) {
      return { error: '이미 있는 상품코드입니다.' }
    }
    let nextId = Math.max(0, ...products.flatMap((p) => p.product_attributes.map((a) => a.id))) + 1
    const product_attributes = attrs.map((a) => ({
      id: nextId++,
      product_code: product.product_code,
      ...a,
    }))
    writeLocal([...products, { ...product, product_attributes }])
    return {}
  }

  if (useWriteApi) return callWriteApi('POST', '', { product, attrs })

  const { error: pErr } = await supabase.from('products').insert(product)
  if (pErr) return { error: `상품 추가 실패: ${pErr.message}` }
  if (attrs.length > 0) {
    const rows = attrs.map((a) => ({ ...a, product_code: product.product_code }))
    const { error: aErr } = await supabase.from('product_attributes').insert(rows)
    if (aErr) {
      // 속성 저장이 실패하면 상품만 남지 않도록 되돌린다
      await supabase.from('products').delete().eq('product_code', product.product_code)
      return { error: `속성 추가 실패(상품도 취소됨): ${aErr.message}` }
    }
  }
  return {}
}

export async function deleteProduct(code) {
  if (mode === 'local') {
    const products = readLocal()
    writeLocal(products.filter((p) => p.product_code !== code))
    return {}
  }
  if (useWriteApi) return callWriteApi('DELETE', `/${encodeURIComponent(code)}`)

  // select()로 실제 삭제된 행을 받아, 권한 정책 때문에 0건 삭제된 경우를 알아낸다
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('product_code', code)
    .select()
  if (error) return { error: `삭제 실패: ${error.message}` }
  if (!data || data.length === 0) {
    return { error: '삭제되지 않았습니다. 삭제 권한(RLS 정책)이 열려 있는지 확인하세요.' }
  }
  return {}
}

// 로컬 모드에서 처음 상태(상품 10건)로 되돌린다
export function resetLocal() {
  localStorage.removeItem(STORAGE_KEY)
}
