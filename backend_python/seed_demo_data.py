import json
from datetime import datetime, timedelta
from pathlib import Path


def _iso_date(d):
    return d.strftime("%Y-%m-%d")


def _iso_dt(dt: datetime) -> str:
    # Keep as ISO string without timezone for compatibility with existing parsing.
    return dt.replace(microsecond=0).isoformat()


def main() -> None:
    base_dir = Path(__file__).parent
    visitors_file = base_dir / "visitors_data.json"
    visits_file = base_dir / "visits_data.json"

    now = datetime.now()
    today = now.date()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    in_two_days = today + timedelta(days=2)
    in_three_days = today + timedelta(days=3)

    visitors = [
        {
            "visitorId": 1,
            "fullName": "Nguyen Van A",
            "idNumber": "012345678901",
            "phone": "0909000001",
            "companyName": "ABC",
            "email": None,
            "appointmentDate": _iso_date(today),
            "appointmentTime": "10:30",
            "hostName": "Giám đốc",
            "department": "Phòng Kế toán",
            "isPreRegistration": True,
            "qrToken": "VISIT-EM001",
        },
        {
            "visitorId": 2,
            "fullName": "Tran Thi B",
            "idNumber": "012345678902",
            "phone": "0909000002",
            "companyName": "XYZ",
            "email": None,
            "appointmentDate": _iso_date(today),
            "appointmentTime": "11:20",
            "hostName": "Giám đốc",
            "department": "Phòng Nhân sự",
            "isPreRegistration": True,
            "qrToken": "VISIT-EM002",
        },
        {
            "visitorId": 3,
            "fullName": "Le Minh C",
            "idNumber": "012345678903",
            "phone": "0909000003",
            "companyName": "QTY",
            "email": None,
            "appointmentDate": _iso_date(today),
            "appointmentTime": "13:10",
            "hostName": "Khác",
            "department": None,
            "isPreRegistration": True,
            "qrToken": "VISIT-GUEST001",
        },
        # Pending approvals (admin/queue)
        {
            "visitorId": 4,
            "fullName": "Minh Tân",
            "idNumber": "456867878909",
            "phone": "0912000001",
            "companyName": "TP91",
            "email": None,
            "appointmentDate": _iso_date(in_two_days),
            "appointmentTime": "10:30",
            "hostName": "Phó giám đốc",
            "department": "Phòng Nhân sự",
            "isPreRegistration": False,
            "qrToken": "VISIT-PD001",
        },
        {
            "visitorId": 5,
            "fullName": "Quốc Bảo",
            "idNumber": "098733456",
            "phone": "0912000002",
            "companyName": "ABC",
            "email": None,
            "appointmentDate": _iso_date(in_two_days),
            "appointmentTime": "14:10",
            "hostName": "Trưởng phòng Kế toán",
            "department": "Phòng Kế toán",
            "isPreRegistration": False,
            "qrToken": "VISIT-PD002",
        },
        {
            "visitorId": 6,
            "fullName": "Lan Anh",
            "idNumber": "02455667788",
            "phone": "0912000003",
            "companyName": "XYZ",
            "email": None,
            "appointmentDate": _iso_date(tomorrow),
            "appointmentTime": "09:00",
            "hostName": "Giám đốc",
            "department": "Văn phòng Giám đốc",
            "isPreRegistration": False,
            "qrToken": "VISIT-PD003",
        },
        # Approved but not yet checked in (appears in receptionist queue)
        {
            "visitorId": 7,
            "fullName": "Trần Minh",
            "idNumber": "077777777777",
            "phone": "0912000004",
            "companyName": "QTY",
            "email": None,
            "appointmentDate": _iso_date(in_three_days),
            "appointmentTime": "11:20",
            "hostName": "Thư ký",
            "department": "Phòng Nhân sự",
            "isPreRegistration": True,
            "qrToken": "VISIT-APP001",
        },
        {
            "visitorId": 8,
            "fullName": "Hoàng Tuấn Phúc",
            "idNumber": "03321555044",
            "phone": "0912000005",
            "companyName": "TP91",
            "email": None,
            "appointmentDate": _iso_date(in_three_days),
            "appointmentTime": "15:44",
            "hostName": "Giám đốc",
            "department": None,
            "isPreRegistration": True,
            "qrToken": "VISIT-APP002",
        },
    ]

    # Visits: active ones (checkOutTime=None) for Dashboard/Alerts/Reception tables.
    # Use yesterday for at least one overdue item so Alerts always shows.
    visits = [
        # Active guest (overdue)
        {
            "visitId": 1,
            "qrOrIdNumber": "VISIT-EM001",
            "vehiclePlate": "",
            "vehicleType": "",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(yesterday, datetime.min.time()).replace(hour=10, minute=15)),
            "checkOutTime": None,
            "vehiclePlateImageRelativePath": None,
        },
        # Active guest (not overdue)
        {
            "visitId": 2,
            "qrOrIdNumber": "VISIT-EM002",
            "vehiclePlate": "",
            "vehicleType": "",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=9, minute=30)),
            "checkOutTime": None,
            "vehiclePlateImageRelativePath": None,
        },
        # Active guest (not employee)
        {
            "visitId": 3,
            "qrOrIdNumber": "VISIT-GUEST001",
            "vehiclePlate": "",
            "vehicleType": "",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=11, minute=5)),
            "checkOutTime": None,
            "vehiclePlateImageRelativePath": None,
        },
        # Guest history (checked out)
        {
            "visitId": 4,
            "qrOrIdNumber": "VISIT-EM002",
            "vehiclePlate": "",
            "vehicleType": "",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=7, minute=45)),
            "checkOutTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=9, minute=0)),
            "vehiclePlateImageRelativePath": None,
        },
        # Active parking (overdue)
        {
            "visitId": 10,
            "qrOrIdNumber": "59-VI11111",
            "vehiclePlate": "59-VI11111",
            "vehicleType": "Xe máy",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(yesterday, datetime.min.time()).replace(hour=16, minute=40)),
            "checkOutTime": None,
            "vehiclePlateImageRelativePath": None,
        },
        # Active parking
        {
            "visitId": 11,
            "qrOrIdNumber": "51F-22222",
            "vehiclePlate": "51F-22222",
            "vehicleType": "Ô tô",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=14, minute=25)),
            "checkOutTime": None,
            "vehiclePlateImageRelativePath": None,
        },
        {
            "visitId": 12,
            "qrOrIdNumber": "60AA33333",
            "vehiclePlate": "60AA33333",
            "vehicleType": "Xe tải",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=15, minute=50)),
            "checkOutTime": None,
            "vehiclePlateImageRelativePath": None,
        },
        # Parking history
        {
            "visitId": 13,
            "qrOrIdNumber": "99-E44444",
            "vehiclePlate": "99-E44444",
            "vehicleType": "Xe tải",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(yesterday, datetime.min.time()).replace(hour=8, minute=10)),
            "checkOutTime": _iso_dt(datetime.combine(yesterday, datetime.min.time()).replace(hour=10, minute=0)),
            "vehiclePlateImageRelativePath": None,
        },
        {
            "visitId": 14,
            "qrOrIdNumber": "99-E55555",
            "vehiclePlate": "99-E55555",
            "vehicleType": "Ô tô",
            "badgeNumber": "",
            "checkInTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=16, minute=20)),
            "checkOutTime": _iso_dt(datetime.combine(today, datetime.min.time()).replace(hour=18, minute=10)),
            "vehiclePlateImageRelativePath": None,
        },
    ]

    visitors_file.write_text(json.dumps(visitors, ensure_ascii=False, indent=2), encoding="utf-8")
    visits_file.write_text(json.dumps(visits, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

