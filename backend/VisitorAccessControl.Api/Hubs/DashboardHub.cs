using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace VisitorAccessControl.Api.Hubs;

[Authorize(Roles = "Admin,Security,Employee")]
public class DashboardHub : Hub
{
}

