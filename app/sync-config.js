// Cấu hình Firebase (Firestore) để đồng bộ tiến độ giữa các máy.
// Đang dùng chung project với app N4 — dữ liệu HSK lưu ở document users/{username}.hsk nên không lẫn nhau.
// Muốn tách riêng: tạo project Firebase mới rồi thay 2 giá trị dưới (xem DONG_BO.md).
const SYNC_CONFIG = {
  projectId: 'tuvungn4',
  apiKey: 'AIzaSyBpBC0zAZGkMvtzvkSva2oDmDrpjMUDvaY',
};
