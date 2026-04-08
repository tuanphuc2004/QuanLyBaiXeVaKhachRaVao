namespace VisitorAccessControl.Api.Entities;

public class Visit
{
    public int VisitId { get; set; }
    public int VisitorId { get; set; }
    public Visitor Visitor { get; set; } = null!;

    public DateTime CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }
    public string Status { get; set; } = "PendingApproval";
    public string? BadgeNumber { get; set; }
    public string VisitQrCode { get; set; } = string.Empty;
    public bool OverstayFlag { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}

