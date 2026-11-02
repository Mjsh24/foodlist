import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createClient } from '@supabase/supabase-js'

// 추가 · 삭제를 개발 서버(Node)에서 service role 키로 처리한다
// 키는 이 파일에서만 읽으므로 브라우저로 내려가는 코드에는 포함되지 않는다
function supabaseWriteApi(env) {
  const admin = createAdmin(env)

  return {
    name: 'supabase-write-api',
    configureServer(server) {
      if (!admin) return
      server.middlewares.use('/api/products', async (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        // 다른 웹사이트가 localhost로 요청을 보내는 것을 막는다
        // 커스텀 헤더가 있으면 브라우저가 사전 확인(preflight)을 하므로 외부 사이트는 통과하지 못한다
        if (req.headers['x-product-manager'] !== '1') return send(403, { error: '허용되지 않은 요청입니다.' })
        if (!/^localhost(:\d+)?$/.test(req.headers.host ?? '')) return send(403, { error: '허용되지 않은 호스트입니다.' })

        try {
          if (req.method === 'POST' && (req.url === '/' || req.url === '')) {
            const { product, attrs } = JSON.parse(await readBody(req))
            if (!product?.product_code) return send(400, { error: '상품코드가 없습니다.' })

            const { error: pErr } = await admin.from('products').insert(product)
            if (pErr) return send(400, { error: `상품 추가 실패: ${pErr.message}` })

            if (Array.isArray(attrs) && attrs.length > 0) {
              const rows = attrs.map((a) => ({ ...a, product_code: product.product_code }))
              const { error: aErr } = await admin.from('product_attributes').insert(rows)
              if (aErr) {
                // 속성 저장이 실패하면 상품만 남지 않도록 되돌린다
                await admin.from('products').delete().eq('product_code', product.product_code)
                return send(400, { error: `속성 추가 실패(상품도 취소됨): ${aErr.message}` })
              }
            }
            return send(200, {})
          }

          if (req.method === 'DELETE' && req.url.length > 1) {
            const code = decodeURIComponent(req.url.slice(1))
            const { data, error } = await admin.from('products').delete().eq('product_code', code).select()
            if (error) return send(400, { error: `삭제 실패: ${error.message}` })
            if (!data || data.length === 0) return send(404, { error: '삭제할 상품을 찾지 못했습니다.' })
            return send(200, {})
          }

          return send(404, { error: '지원하지 않는 요청입니다.' })
        } catch (e) {
          return send(500, { error: `서버 오류: ${e.message}` })
        }
      })
    },
  }
}

function createAdmin(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) return null
  return createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// 로컬 전용: localhost에서만 접속되도록 호스트를 고정한다
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), supabaseWriteApi(env)],
    // 화면에는 키 값이 아니라 "서버 쓰기 기능을 쓸 수 있는지"만 전달한다
    define: { __WRITE_API__: JSON.stringify(Boolean(createAdmin(env))) },
    // 상품 시드 데이터(docs/dummy/seed)를 읽을 수 있게 상위 폴더 접근을 허용한다
    server: { host: 'localhost', port: 5173, fs: { allow: ['..'] } },
  }
})
