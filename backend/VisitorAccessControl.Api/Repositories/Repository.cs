using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using VisitorAccessControl.Api.Data;
using VisitorAccessControl.Api.Models;

namespace VisitorAccessControl.Api.Repositories;

public class Repository<T> : IRepository<T> where T : class
{
    private readonly AppDbContext _context;
    private readonly DbSet<T> _dbSet;

    public Repository(AppDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public async Task<T?> GetByIdAsync(int id)
    {
        return await _dbSet.FindAsync(id);
    }

    public async Task<PagedResult<T>> GetPagedAsync(
        int pageNumber,
        int pageSize,
        Expression<Func<T, bool>>? predicate = null,
        Func<IQueryable<T>, IOrderedQueryable<T>>? orderBy = null)
    {
        IQueryable<T> query = _dbSet;

        if (predicate != null)
        {
            query = query.Where(predicate);
        }

        if (orderBy != null)
        {
            query = orderBy(query);
        }

        var total = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<T>
        {
            Items = items,
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalRecords = total
        };
    }

    public async Task AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
    }

    public void Update(T entity)
    {
        _dbSet.Update(entity);
    }

    public void SoftDelete(T entity)
    {
        var propIsDeleted = entity.GetType().GetProperty("IsDeleted");
        var propDeletedAt = entity.GetType().GetProperty("DeletedAt");

        if (propIsDeleted != null)
        {
            propIsDeleted.SetValue(entity, true);
        }

        if (propDeletedAt != null)
        {
            propDeletedAt.SetValue(entity, DateTime.UtcNow);
        }

        _dbSet.Update(entity);
    }

    public Task<int> SaveChangesAsync()
    {
        return _context.SaveChangesAsync();
    }
}

