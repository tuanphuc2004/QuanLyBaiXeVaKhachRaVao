using VisitorAccessControl.Api.Entities;
using VisitorAccessControl.Api.Models;

namespace VisitorAccessControl.Api.Services;

public interface IVisitorService
{
    Task<PagedResult<Visitor>> SearchVisitorsAsync(int page, int size, string? searchTerm);
    Task<Visitor> CreateVisitorAsync(Visitor visitor);
}

