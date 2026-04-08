using System.Linq.Expressions;
using Microsoft.Extensions.Logging;
using VisitorAccessControl.Api.Entities;
using VisitorAccessControl.Api.Models;
using VisitorAccessControl.Api.Repositories;

namespace VisitorAccessControl.Api.Services;

public class VisitorService : IVisitorService
{
    private readonly IRepository<Visitor> _visitorRepository;
    private readonly ILogger<VisitorService> _logger;

    public VisitorService(IRepository<Visitor> visitorRepository, ILogger<VisitorService> logger)
    {
        _visitorRepository = visitorRepository;
        _logger = logger;
    }

    public async Task<PagedResult<Visitor>> SearchVisitorsAsync(int page, int size, string? searchTerm)
    {
        _logger.LogInformation("Searching visitors Page={Page} Size={Size} Term={Term}", page, size, searchTerm);

        Expression<Func<Visitor, bool>>? predicate = null;

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            predicate = v =>
                v.FullName.Contains(searchTerm) ||
                (v.IdNumber != null && v.IdNumber.Contains(searchTerm)) ||
                (v.Phone != null && v.Phone.Contains(searchTerm));
        }

        return await _visitorRepository.GetPagedAsync(
            page,
            size,
            predicate,
            q => q.OrderByDescending(v => v.CreatedAt));
    }

    public async Task<Visitor> CreateVisitorAsync(Visitor visitor)
    {
        visitor.FullName = visitor.FullName.Trim();

        await _visitorRepository.AddAsync(visitor);
        await _visitorRepository.SaveChangesAsync();

        _logger.LogInformation("Created visitor {VisitorId} - {FullName}", visitor.VisitorId, visitor.FullName);

        return visitor;
    }
}

