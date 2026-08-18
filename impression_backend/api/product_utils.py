def normalize_product_name(name):
    if name is None:
        return ''
    return ' '.join(str(name).strip().split())


def find_product_by_normalized_name(company_id, product_name, exclude_id=None):
    from .models import Product

    normalized = normalize_product_name(product_name)
    if not normalized:
        return None

    products = Product.objects.filter(company_id=company_id).only(
        'id', 'product_name', 'created_by_id', 'company_id'
    )
    if exclude_id is not None:
        products = products.exclude(id=exclude_id)

    for product in products:
        if normalize_product_name(product.product_name) == normalized:
            return product
    return None


def get_or_create_normalized_product(company, product_name, created_by=None):
    from .models import Product

    normalized = normalize_product_name(product_name)
    if not normalized:
        raise ValueError('Product name is required.')

    existing = find_product_by_normalized_name(company.id, normalized)
    if existing:
        return existing, False

    product = Product.objects.create(
        product_name=normalized,
        company=company,
        created_by=created_by,
    )
    return product, True
