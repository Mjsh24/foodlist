import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { addProduct, deleteProduct, listProducts, mode, resetLocal } from './store.js'
import { getAllergyInfo } from './allergy.js'
import ProductForm, { KINDS } from './ProductForm.jsx'

const ALLERGY_FILTERS = [
  { value: 'all', label: '알레르기 전체' },
  { value: 'warn', label: '주의 있음' },
  { value: 'none', label: '없음 확인' },
  { value: 'unknown', label: '미확인' },
]

function AllergyBadge({ info }) {
  if (info.status === 'warn') {
    const text = info.allergens.length > 0 ? info.allergens.join(', ') : '주의'
    return <span className="badge warn">{text}</span>
  }
  if (info.status === 'none') return <span className="badge none">없음</span>
  return <span className="badge unknown">미확인</span>
}

function Detail({ product, info }) {
  // 속성을 구분별로 묶어 KINDS 순서대로 보여 준다
  const grouped = KINDS.map((kind) => ({
    kind,
    rows: product.product_attributes.filter((a) => a.kind === kind),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="detail">
      <p><strong>원재료</strong> {product.ingredients ?? '-'}</p>
      {info.allergens.length > 0 && (
        <p><strong>알레르기 성분</strong> {info.allergens.join(', ')}</p>
      )}
      {grouped.length === 0 && <p className="muted">등록된 속성이 없습니다.</p>}
      {grouped.map((g) => (
        <div key={g.kind} className="kind-block">
          <span className="kind">{g.kind}</span>
          <ul>
            {g.rows.map((a) => (
              <li key={a.id}>
                {a.content}
                {a.value != null && <span className="muted"> ({a.value}{a.unit})</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [allergyFilter, setAllergyFilter] = useState('all')
  const [openCode, setOpenCode] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await listProducts()
    if (err) setError(`불러오기 실패: ${err}`)
    else setProducts(data.map((p) => ({ ...p, allergy: getAllergyInfo(p.product_attributes) })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  )

  // 검색: 코드, 이름, 분류, 원산지, 원재료, 속성 내용, 알레르기 성분
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (allergyFilter !== 'all' && p.allergy.status !== allergyFilter) return false
      if (!q) return true
      const haystack = [
        p.product_code, p.name, p.category, p.origin, p.ingredients,
        ...p.product_attributes.map((a) => a.content),
        ...p.allergy.allergens,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [products, query, category, allergyFilter])

  async function handleAdd(product, attrs) {
    setBusy(true)
    setError('')
    const { error: err } = await addProduct(product, attrs)
    setBusy(false)
    if (err) return setError(err)
    setShowForm(false)
    setNotice(`${product.product_code} ${product.name} 추가됨`)
    load()
  }

  async function handleDelete(p) {
    if (!window.confirm(`${p.product_code} ${p.name}\n상품과 속성을 모두 삭제합니다. 계속할까요?`)) return
    setError('')
    const { error: err } = await deleteProduct(p.product_code)
    if (err) return setError(err)
    setNotice(`${p.product_code} ${p.name} 삭제됨`)
    if (openCode === p.product_code) setOpenCode(null)
    load()
  }

  function handleReset() {
    if (!window.confirm('추가 · 삭제한 내용을 모두 버리고 처음 상태(상품 10건)로 되돌립니다. 계속할까요?')) return
    resetLocal()
    setNotice('처음 상태로 되돌렸습니다.')
    load()
  }

  return (
    <main className="page">
      <header className="top">
        <h1>상품 관리 <span className="muted">(가상 상품 · 로컬 전용)</span></h1>
        <div className="top-actions">
          <span className="muted">
            {mode === 'local' ? '저장: 이 브라우저' : '저장: Supabase'}
          </span>
          {mode === 'local' && <button className="ghost" onClick={handleReset}>처음 상태로</button>}
          <button onClick={() => { setNotice(''); setError(''); setShowForm(true) }}>+ 상품 추가</button>
        </div>
      </header>

      <div className="filters">
        <input
          className="search"
          placeholder="검색: 코드, 이름, 분류, 원산지, 속성 내용, 알레르기 성분"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">분류 전체</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={allergyFilter} onChange={(e) => setAllergyFilter(e.target.value)}>
          {ALLERGY_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : (
        <>
          <p className="muted">{filtered.length} / {products.length}건</p>
          <table>
            <thead>
              <tr>
                <th>상품코드</th><th>상품명</th><th>분류</th><th className="r">가격</th>
                <th>용량</th><th>원산지</th><th>알레르기</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <Fragment key={p.product_code}>
                  <tr
                    className="row"
                    onClick={() => setOpenCode(openCode === p.product_code ? null : p.product_code)}
                  >
                    <td>{p.product_code}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td className="r">{p.price.toLocaleString()}원</td>
                    <td>{p.volume != null ? `${p.volume}${p.volume_unit ?? ''}` : '-'}</td>
                    <td>{p.origin ?? '-'}</td>
                    <td><AllergyBadge info={p.allergy} /></td>
                    <td>
                      <button
                        className="danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(p) }}
                      >삭제</button>
                    </td>
                  </tr>
                  {openCode === p.product_code && (
                    <tr className="detail-row">
                      <td colSpan={8}><Detail product={p} info={p.allergy} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="muted center">조건에 맞는 상품이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {showForm && (
        <ProductForm busy={busy} serverError={error} onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
      )}
    </main>
  )
}
