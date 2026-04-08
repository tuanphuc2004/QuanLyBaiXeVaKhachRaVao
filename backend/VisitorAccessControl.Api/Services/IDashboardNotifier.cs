using VisitorAccessControl.Api.Models;

namespace VisitorAccessControl.Api.Services;

public interface IDashboardNotifier
{
    Task NotifyDashboardUpdatedAsync(DashboardSummary summary);
}

public class DashboardSummary
{
    public int CurrentVisitors { get; set; }
    public int CurrentVehicles { get; set; }
    public int PendingApprovals { get; set; }
}

