속안심내과 외래예약 V2 — 세 분 통합 (오지혜·박철연 원장님, 박준우 과장님)

반영 내용
- 디자인은 기존 V2 그대로 (상단 남색 '속안심내과', 황금색 S 심볼)
- 조회하면 세 분 예약이 한 번에 나오고, 예약마다 담당 선생님 표시
- 달력은 그 예약 선생님의 진료시간·휴진일 기준
- 직원용 통합 외래예약 웹과 같은 예약DB 사용

Vercel 환경변수
- OUTPATIENT_GAS_URL  (예약DB 환자용 Apps Script 웹 앱 주소)
- OUTPATIENT_API_KEY  (setupPatientApi 로그의 키)
- 예전 GOOGLE_SCRIPT_URL / PATIENT_API_KEY 는 더 이상 쓰지 않음

---- 이전 메모 ----
속안심내과 오지혜 원장님 외래예약 V2 - 상단 한글+영문 최종본

반영 내용
- 상단: S 심볼 없이 남색 '속안심내과'
- 바로 아래: SOKANSIM INTERNAL MEDICINE
- 담당 의료진 카드: 황금색 S 심볼 유지
- 환자 기능: 예약 확인 / 변경 / 취소만
- 신규 예약 기능 없음

Vercel 환경변수
- GOOGLE_SCRIPT_URL
- PATIENT_API_KEY
