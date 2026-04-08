using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VisitorAccessControl.Api.Entities;
using VisitorAccessControl.Api.Models;
using VisitorAccessControl.Api.Services;

namespace VisitorAccessControl.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Security")]
public class VisitorsController : ControllerBase
{
    private readonly IVisitorService _visitorService;

    public VisitorsController(IVisitorService visitorService)
    {
        _visitorService = visitorService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<Visitor>>> GetVisitors(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? searchTerm = null)
    {
        var result = await _visitorService.SearchVisitorsAsync(pageNumber, pageSize, searchTerm);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<Visitor>> CreateVisitor([FromBody] CreateVisitorDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var visitor = new Visitor
        {
            FullName = dto.FullName,
            IdNumber = dto.IdNumber,
            Phone = dto.Phone,
            CompanyName = dto.CompanyName
        };

        var created = await _visitorService.CreateVisitorAsync(visitor);

        return CreatedAtAction(nameof(GetVisitors), new { id = created.VisitorId }, created);
    }
}

public class CreateVisitorDto
{
    public string FullName { get; set; } = string.Empty;
    public string? IdNumber { get; set; }
    public string? Phone { get; set; }
    public string? CompanyName { get; set; }
}

