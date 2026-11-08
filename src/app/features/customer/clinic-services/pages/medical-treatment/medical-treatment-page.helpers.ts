/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Services/MedicalTreatmentPage.jsx)
 */
import { medicalAssets, medicalDoctorPages, medicalFaqs, medicalServices, medicalStats, medicalWhyItems } from '../../data/medical-treatment-data';

export function formatServicePrice(value: any) {
  const price = Number(value)
  if (!Number.isFinite(price) || price <= 0) return 'Liên hệ'
  return `Từ ${price.toLocaleString('vi-VN')} đ`
}

export function getMedicalServiceFallback(service: any = {}) {
  const serviceName = `${service.name || ''} ${service.desc || ''}`.toLocaleLowerCase('vi')

  return (
    medicalServices.find((item: any) =>
      serviceName.includes(item.title.toLocaleLowerCase('vi')),
    ) ||
    medicalServices.find((item: any) => /sau điều trị|thay băng|hậu phẫu/.test(serviceName) && item.title === 'Chăm sóc sau điều trị') ||
    medicalServices.find((item: any) => /khám|điều trị/.test(serviceName) && item.title === 'Khám sức khỏe tổng quát') ||
    medicalServices.find((item: any) => /xét nghiệm/.test(serviceName) && item.title === 'Xét nghiệm') ||
    medicalServices.find((item: any) => /siêu âm|x-quang/.test(serviceName) && item.title === 'Siêu âm') ||
    medicalServices.find((item: any) => /tiêm|vaccine|phòng/.test(serviceName) && item.title === 'Tiêm phòng') ||
    medicalServices.find((item: any) => /phẫu thuật|triệt sản/.test(serviceName) && item.title === 'Phẫu thuật') ||
    medicalServices.find((item: any) => /cấp cứu/.test(serviceName) && item.title === 'Cấp cứu 24/7') ||
    medicalServices[0]
  )
}

export function mergeMedicalServiceCards(apiServices: any[] = []) {
  return medicalServices.map((service: any) => {
    const apiService = apiServices.find((item: any) => {
      const serviceName = `${item.name || ''} ${item.desc || ''}`.toLocaleLowerCase('vi')
      const matchesMedicalService = /khám|điều trị|xét nghiệm|siêu âm|x-quang|tiêm|vaccine|phòng|phẫu thuật|triệt sản|cấp cứu|sau điều trị|thay băng|hậu phẫu/.test(serviceName)

      return matchesMedicalService && getMedicalServiceFallback(item) === service
    })

    return apiService
      ? {
          ...service,
          price: formatServicePrice(apiService.price),
          description: apiService.desc || service.description,
        }
      : service
  })
}
