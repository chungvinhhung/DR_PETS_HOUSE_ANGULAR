/**
 * Chuyển từ React: src/data/groomingData.js
 */
import { groomingImages } from '../assets/grooming-images';

export const GROOMING_FAQS = [
  { id: 1, question: "Bao lâu thì nên tắm cho thú cưng?", answer: ["Với Chó: Tắm 1 lần/tháng là tần suất lý tưởng nhất. Tránh tắm quá 1 lần/tuần trừ khi có chỉ định từ bác sĩ, vì lạm dụng sẽ làm khô da và mất đi độ bóng của lông.", "Với Mèo: Mèo là loài tự làm sạch cơ thể rất giỏi. Bạn chỉ nên tắm cho chúng khi thực sự cần thiết (dính bẩn, ve rận hoặc mèo lông dài)."] },
  { id: 2, question: "Thú cưng chưa tiêm phòng đầy đủ có được làm spa không?", answer: ["Các spa thường từ chối nhận thú cưng chưa tiêm đủ mũi vắc-xin cốt lõi.", "Để bảo vệ sức khỏe cho chính thú cưng của bạn và tránh lây nhiễm chéo cho các bé khác tại cửa hàng.", "Bạn có thể đặt lịch và sử dụng dịch vụ tiêm phòng của chúng tôi."] },
  { id: 3, question: "Bao lâu thì nên cắt móng cho thú cưng?", answer: ["Bạn nên cắt móng cho chó và mèo định kỳ 2 đến 4 tuần/lần. Tần suất này có thể thay đổi tùy thuộc vào mức độ hoạt động và độ mài mòn tự nhiên của móng."] },
  { id: 4, question: "Chủ nuôi có được ở lại xem trực tiếp quá trình làm spa không?", answer: ["Thường là không nên vì thú cưng thấy chủ sẽ dễ phấn khích, bồn chồn và không đứng yên.", "Bạn có thể quan sát qua phòng kính cách âm hoặc xem camera giám sát tại phòng chờ của cửa hàng."] },
  { id: 5, question: "Thú cưng bị nhát, hung dữ hoặc sợ nước thì spa có nhận không?", answer: ["Spa vẫn nhận nhưng bạn cần thông báo trước với nhân viên để có biện pháp xử lý phù hợp.", "Nhân viên sẽ dùng kỹ thuật trấn an, dùng loa che mắt hoặc đeo rọ mõm vải mềm để đảm bảo an toàn cho cả hai bên."] },
];

export const GROOMING_REVIEWS = (Array.from({ length: 3 }, (_: any, index: any) => ({
  id: index + 1,
  lines: ["These are the perfect size for our small", "dog. The design is cute and the rubber on", "the bottom is great because it makes them", "more durable. They've held up to being..."],
  author: "Mary Douglas",
  company: "Pet Shop Inc.",
})) as any);

export const GROOMING_SERVICES = [
  { id: 1, title: "Tắm & Sấy khô", description: "Sử dụng các dòng sữa tắm cao cấp, phù hợp với từng loại da và màu lông của bé.", price: "Từ 50.000đ", image: groomingImages.serviceBath, mask: groomingImages.serviceCardMask },
  { id: 2, title: "Massage chuyên sâu", description: "Kỹ thuật massage nhẹ nhàng giúp pet giải tỏa áp lực, tăng cường sự gắn kết", price: "Từ 50.000đ", image: groomingImages.serviceMassage, mask: groomingImages.serviceCardMask },
  { id: 3, title: "Vệ sinh răng miệng", description: "Đánh răng loại bỏ mảng bám và xịt thơm miệng khử mùi hôi.", price: "Từ 30.000đ", image: groomingImages.serviceTeeth, mask: groomingImages.serviceCardMask },
  { id: 4, title: "Cắt & mài móng", description: "Cắt ngắn móng tránh đâm vào thịt và dùng máy mài mịn các góc sắc nhọn", price: "Từ 30.000đ", image: groomingImages.serviceNail, mask: groomingImages.serviceCardMaskAlt },
  { id: 5, title: "Chăm sóc bàn chân", description: "Cạo vệ sinh kẽ móng, chăm sóc bảo vệ phần đệm thịt", price: "Từ 30.000đ", image: groomingImages.servicePawCare, mask: groomingImages.serviceCardMask },
  { id: 6, title: "Điều trị ký sinh trùng", description: "Tiêu diệt ký sinh trùng và làm sạch môi trường sống để ngăn ngừa tái nhiễm", price: "Từ 80.000đ", image: groomingImages.serviceParasite, mask: groomingImages.serviceCardMask },
  { id: 7, title: "Cắt tỉa tạo kiểu", description: "Cắt tỉa lông theo yêu cầu hoặc theo form chuẩn của từng giống loài", price: "Từ 50.000đ", image: groomingImages.serviceGrooming, mask: groomingImages.serviceCardMask },
  { id: 8, title: "Nhuộm lông thời trang", description: "Sử dụng thuốc nhuộm organic 100% an toàn cho thú cưng, tạo điểm nhấn đặc biệt", price: "Từ 80.000đ", image: groomingImages.serviceDye, mask: groomingImages.serviceCardMask },
  { id: 9, title: "Vắt tuyến hôi", description: "Giúp thú cưng không bị ngứa ngáy hậu môn, hạn chế mùi hôi đặc trưng cơ thể", price: "Từ 50.000đ", image: groomingImages.serviceScent, mask: groomingImages.serviceCardMask },
];

export const GROOMING_PRICE_COLUMNS = [
  { label: "< 5kg", tone: "primary" },
  { label: "5.1 - 10kg", tone: "success" },
  { label: "10.1 - 20kg", tone: "secondary" },
  { label: "20.1 - 30kg", tone: "danger" },
  { label: "> 30kg", tone: "info" },
];

export const SERVICE_PRICE_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "medical", label: "Khám & Điều trị" },
  { value: "grooming", label: "Grooming & Spa" },
  { value: "combo", label: "Combo siêu tiết kiệm" },
];

export const GROOMING_PRICING_ROWS = [
  { title: "Tắm & Sấy khô", icon: "bath", iconColor: "#2d63c8", background: "#cce1fe", prices: ["70k", "100k", "170k", "270k", "Liên hệ"] },
  { title: "Massage chuyên sâu", icon: "sprout", iconColor: "#00c7a2", background: "#cffff5", prices: ["75k", "110k", "180k", "280k", "Liên hệ"] },
  { title: "Cắt tỉa tạo kiểu", icon: "scissors", iconColor: "#ef4444", background: "#ffd6d6", prices: ["85k", "130k", "240k", "380k", "Liên hệ"] },
  { title: "Vắt tuyến hôi", icon: "sparkles", iconColor: "#d99a16", background: "#fffbdc", prices: ["65k", "90k", "135k", "200k", "Liên hệ"] },
  { title: "Điều trị ký sinh trùng", icon: "bug", iconColor: "#8b5cf6", background: "#efd8ff", prices: ["110k", "150k", "250k", "365k", "Liên hệ"] },
  { title: "Nhuộm lông thời trang", icon: "palette", iconColor: "#ff2bbb", background: "#ffe0f1", prices: ["120k", "180k", "340k", "540k", "Liên hệ"] },
  { title: "Vệ sinh răng miệng", icon: "tooth", iconColor: "#f59e0b", background: "#fff2dc", prices: ["45k", "80k", "130k", "200k", "Liên hệ"] },
  { title: "Cắt & Mài móng", icon: "scissors", iconColor: "#08a8e8", background: "#d0e9ff", prices: ["45k", "70k", "105k", "160k", "Liên hệ"] },
  { title: "Chăm sóc bàn chân", icon: "paw", iconColor: "#d69b16", background: "#f7ffdd", prices: ["45k", "70k", "105k", "160k", "Liên hệ"] },
];

/** Khám & Điều trị: 1 mức giá chung cho mọi cân nặng */
export const MEDICAL_PRICING_ROWS = [
  { title: "Khám sức khỏe tổng quát", icon: "stethoscope", iconColor: "#2d63c8", background: "#cce1fe", prices: ["Từ 150k"] },
  { title: "Siêu âm", icon: "heartPulse", iconColor: "#ff2bbb", background: "#ffe0f1", prices: ["Từ 250k"] },
  { title: "Xét nghiệm / Test nhanh", icon: "flask", iconColor: "#00c7a2", background: "#cffff5", prices: ["Từ 250k"] },
  { title: "Tiêm phòng", icon: "syringe", iconColor: "#d99a16", background: "#ffffdf", prices: ["Từ 200k"] },
  { title: "Phẫu thuật / Triệt sản", icon: "scalpel", iconColor: "#8b5cf6", background: "#ecd8ff", prices: ["Từ 800k"] },
  { title: "Chăm sóc sau điều trị", icon: "stethoscope", iconColor: "#2d63c8", background: "#cce1fe", prices: ["Từ 120k"] },
  { title: "Cấp cứu 24/7", icon: "siren", iconColor: "#ef4444", background: "#ffd8d8", prices: ["Báo giá sau tiếp nhận"] },
];

export const COMBO_PRICING_ROWS = [
  { title: "Combo Tắm 11 bước", icon: "bath", iconColor: "#2d63c8", background: "#cce1fe", prices: ["90k", "90k", "90k", "120k", "Liên hệ"] },
  { title: "Combo Tắm cơ bản & cắt tỉa", icon: "sprout", iconColor: "#00c7a2", background: "#cffff5", prices: ["90k", "90k", "90k", "120k", "Liên hệ"] },
  { title: "Combo Chăm sóc & bảo vệ móng", icon: "paw", iconColor: "#d69b16", background: "#f7ffdd", prices: ["90k", "90k", "90k", "120k", "Liên hệ"] },
];

export const SERVICE_PRICE_TABLES = {
  medical: MEDICAL_PRICING_ROWS,
  grooming: GROOMING_PRICING_ROWS,
  combo: COMBO_PRICING_ROWS,
};

export const GROOMING_COMBO_STEPS = [
  "Kiểm tra lông, da", "Cạo lông bàn chân", "Cạo lông bụng", "Cạo lông hậu môn",
  "Vắt tuyến hôi", "Vệ sinh tai", "Cắt, mài móng", "Tắm xả chuyên sâu 2 lần",
  "Massage làm sạch", "Sấy chải tạo độ phồng lông", "Xịt thơm dưỡng bóng lông",
];

export const GROOMING_VALUE_PROPS = [
  { num: "01", title: "Sản phẩm chăm sóc chất lượng & an toàn", desc: "Sự an toàn và thoải mái của bé cưng luôn là ưu tiên hàng đầu. Chúng tôi cam kết 100% trang thiết bị và dụng cụ sử dụng đều đạt tiêu chuẩn chất lượng cao và an toàn tuyệt đối.", top: 226 },
  { num: "02", title: "Đội ngũ chuyên viên được đào tạo bài bản", desc: "Đội ngũ chuyên viên chuyên nghiệp, sở hữu tình yêu lớn với động vật và nền tảng chuyên môn vững chắc. Bảo đảm sẽ giúp bé cưng của bạn có những phút giây thoải mái.", top: 425 },
  { num: "03", title: "Bảng giá minh bạch & Chi phí hợp lý", desc: "Chúng tôi mang đến giải pháp chăm sóc thú cưng toàn diện với mức giá cạnh tranh nhất thị trường, đi kèm chất lượng dịch vụ vượt trội xuất phát từ tình yêu thương.", top: 624 },
];
