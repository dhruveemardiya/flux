import re
import django.utils.cache

if not hasattr(django.utils.cache, 'cc_delim_re'):
    django.utils.cache.cc_delim_re = re.compile(r"\s*,\s*")

