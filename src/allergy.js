// 알레르기 성분 목록 (supabase_queries.sql의 allergen_list와 같은 순서)
export const ALLERGEN_LIST = ['밀', '대두', '계란', '우유', '땅콩', '견과류', '메밀', '새우', '호두']

const NONE_TEXT = '알레르기 유발 물질 없음'

// 상품의 알레르기 상태를 계산한다
// status: 'warn'(주의 있음) | 'none'(없음 확인) | 'unknown'(미확인 또는 정보 없음)
export function getAllergyInfo(attributes = []) {
  const rows = attributes.filter((a) => a.kind === '알레르기')
  const unknownRow = rows.some((a) => a.content.includes('미확인'))
  const notes = rows
    .filter((a) => a.content !== NONE_TEXT && !a.content.includes('미확인'))
    .map((a) => a.content)

  const allergens = ALLERGEN_LIST.filter((name) => notes.some((n) => n.includes(name)))

  let status = 'unknown'
  if (notes.length > 0) status = 'warn'
  else if (!unknownRow && rows.some((a) => a.content === NONE_TEXT)) status = 'none'

  return { status, allergens, notes }
}
