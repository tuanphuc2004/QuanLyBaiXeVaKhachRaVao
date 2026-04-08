using Microsoft.EntityFrameworkCore;
using VisitorAccessControl.Api.Entities;

namespace VisitorAccessControl.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Visitor> Visitors => Set<Visitor>();
    public DbSet<Visit> Visits => Set<Visit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Visitor>().HasQueryFilter(v => !v.IsDeleted);
        modelBuilder.Entity<Visit>().HasQueryFilter(v => !v.IsDeleted);

        base.OnModelCreating(modelBuilder);
    }
}

