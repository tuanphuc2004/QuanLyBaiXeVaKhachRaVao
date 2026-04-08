using Microsoft.AspNetCore.SignalR;
using VisitorAccessControl.Api.Hubs;
using VisitorAccessControl.Api.Models;

namespace VisitorAccessControl.Api.Services;

public class DashboardNotifier : IDashboardNotifier
{
    private readonly IHubContext<DashboardHub> _hubContext;

    public DashboardNotifier(IHubContext<DashboardHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task NotifyDashboardUpdatedAsync(DashboardSummary summary)
    {
        return _hubContext.Clients.All.SendAsync("DashboardUpdated", summary);
    }
}

