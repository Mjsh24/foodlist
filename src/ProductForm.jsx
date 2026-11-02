import { useState } from 'react'

// product_attributes.kind 허용값 (DB check 제약과 같아야 한다)
export const KINDS = [
  '알레르기', '보관방법', '보관금지', '보관기간', '개봉후보관기간',
  '유통기한', '섭취안내', '조리안내', '주의사항', '특징',
]

const EMPTY_PRODUCT = {
  product_code: '', name: '', category: '', price: '',
  volume: '', volume_unit: '', origin: '', ingredients: '',
}
const EMPTY_ATTR = { kind: '특징', content: '', value: '', unit: '' }

// 빈 문자열은 null, 아니면 숫자로 바꾼다
const toNumberOrNull = (v) => (v === '' ? null : Number(v))
const toTextOrNull = (v) => (v.trim() === '' ? null : v.trim())

export default function ProductForm({ onSubmit, onCancel, busy, serverError }) {
  const [product, setProduct] = useState(EMPTY_PRODUCT)
  const [attrs, setAttrs] = useState([])
  const [error, setError] = useState('')

  const setField = (key) => (e) => setProduct({ ...product, [key]: e.target.value })
  const setAttr = (i, key, val) =>
    setAttrs(attrs.map((a, idx) => (idx === i ? { ...a, [key]: val } : a)))

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!product.product_code.trim() || !product.name.trim() || !product.category.trim()) {
      return setError('상품코드, 상품명, 분류는 필수입니다.')
    }
    if (product.price === '' || Number(product.price) < 0) {
      return setError('가격은 0 이상의 숫자로 입력하세요.')
    }
    if (product.volume !== '' && Number(product.volume) <= 0) {
      return setError('용량은 0보다 커야 합니다.')
    }
    // 빈 속성 행은 버리고, 값이 있으면 단위도 있어야 한다 (DB check 제약)
    const cleanAttrs = attrs.filter((a) => a.content.trim() !== '')
    for (const a of cleanAttrs) {
      if (a.value !== '' && a.unit.trim() === '') {
        return setError(`'${a.content}' 속성은 값이 있으면 단위도 입력해야 합니다.`)
      }
    }

    onSubmit(
      {
        product_code: product.product_code.trim(),
        name: product.name.trim(),
        category: product.category.trim(),
        price: Number(product.price),
        volume: toNumberOrNull(product.volume),
        volume_unit: toTextOrNull(product.volume_unit),
        origin: toTextOrNull(product.origin),
        ingredients: toTextOrNull(product.ingredients),
      },
      cleanAttrs.map((a) => ({
        kind: a.kind,
        content: a.content.trim(),
        value: toNumberOrNull(a.value),
        unit: toTextOrNull(a.unit),
      })),
    )
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>상품 추가</h2>

        <div className="grid">
          <label>상품코드 *<input value={product.product_code} onChange={setField('product_code')} placeholder="P-0500" /></label>
          <label>상품명 *<input value={product.name} onChange={setField('name')} /></label>
          <label>분류 *<input value={product.category} onChange={setField('category')} placeholder="생과일, 건조과자 ..." /></label>
          <label>가격(원) *<input type="number" min="0" value={product.price} onChange={setField('price')} /></label>
          <label>용량<input type="number" min="0" step="any" value={product.volume} onChange={setField('volume')} /></label>
          <label>용량단위<input value={product.volume_unit} onChange={setField('volume_unit')} placeholder="g, kg, ml" /></label>
          <label>원산지<input value={product.origin} onChange={setField('origin')} /></label>
          <label>원재료<input value={product.ingredients} onChange={setField('ingredients')} /></label>
        </div>

        <h3>상품 속성 <span className="muted">(선택, 없는 정보는 추가하지 않기)</span></h3>
        {attrs.map((a, i) => (
          <div className="attr-row" key={i}>
            <select value={a.kind} onChange={(e) => setAttr(i, 'kind', e.target.value)}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <input className="grow" placeholder="내용" value={a.content} onChange={(e) => setAttr(i, 'content', e.target.value)} />
            <input className="num" type="number" step="any" placeholder="값" value={a.value} onChange={(e) => setAttr(i, 'value', e.target.value)} />
            <input className="unit" placeholder="단위" value={a.unit} onChange={(e) => setAttr(i, 'unit', e.target.value)} />
            <button type="button" className="ghost" onClick={() => setAttrs(attrs.filter((_, idx) => idx !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setAttrs([...attrs, EMPTY_ATTR])}>+ 속성 추가</button>

        {(error || serverError) && <p className="error">{error || serverError}</p>}

        <div className="actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>취소</button>
          <button type="submit" disabled={busy}>{busy ? '저장 중...' : '저장'}</button>
        </div>
      </form>
    </div>
  )
}
