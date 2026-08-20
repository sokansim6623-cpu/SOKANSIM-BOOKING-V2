속안심내과 오지혜 원장님 외래예약 V2

파일 구성
- index.html : 환자 화면
- styles.css : 디자인
- app.js : 예약 신청/조회/변경/취소
- api/booking.js : Vercel 서버에서 Apps Script로 연결
- vercel.json : Vercel 함수 설정
- .env.example : 필요한 환경변수 이름

중요
PATIENT_API_KEY를 index.html 또는 app.js에 직접 넣지 마세요.
비밀키는 Vercel 환경변수에만 입력합니다.

Vercel 환경변수
1) GOOGLE_SCRIPT_URL
   Apps Script 웹 앱 URL 전체

2) PATIENT_API_KEY
   Apps Script의 showPatientApiKey 실행 로그에서 확인한 키

배포 후 확인
- 첫 화면에서 예약 신청 탭이 보이는지
- 환자명/휴대폰 뒤 4자리 입력 후 달력이 열리는지
- 설정 시트의 진료시간/점심시간/휴진일이 반영되는지
- 예약 후 예약관리 시트에 한 줄이 추가되는지
- 예약 확인/변경/취소가 동작하는지
