using System.Linq.Expressions;
using VisitorAccessControl.Api.Models;

namespace VisitorAccessControl.Api.Repositories;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);

    Task<PagedResult<T>> GetPagedAsync(
        int pageNumber,
        int pageSize,
        Expression<Func<T, bool>>? predicate = null,
        Func<IQueryable<T>, IOrderedQueryable<T>>? orderBy = null);

    Task AddAsync(T entity);
    void Update(T entity);
    void SoftDelete(T entity);
    Task<int> SaveChangesAsync();
}

