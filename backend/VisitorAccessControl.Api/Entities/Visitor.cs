namespace VisitorAccessControl.Api.Entities;

public class Visitor
{
    public int VisitorId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? IdNumber { get; set; }
    public string? Phone { get; set; }
    public string? CompanyName { get; set; }
    public bool IsBlacklisted { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public ICollection<Visit> Visits { get; set; } = new List<Visit>();
}

